import { desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles } from "../../schema/articles/articles.js";
import { risks } from "../../schema/risks/risks.js";
import { HttpError } from "../../utils/httpError.js";
import {
  findCatalogRiskMatches,
  isDomainMappedToCatalog,
  mergeCatalogMatchesIntoExtraction,
  parseCatalogMatchesFromExtraction,
} from "./riskCatalogMatch.service.js";
import {
  mapRiskRowToDto,
  type ReviewQueueItemDto,
  type RiskDto,
} from "./riskDto.js";
import { resolveRiskUuid } from "./riskResolve.js";
import { buildRiskDisplayIdMap } from "./riskSequence.js";

export type RiskListMetrics = {
  total: number;
  technical: number;
  operational: number;
  business: number;
};

function countByPrimaryKey(rows: RiskDto[]): Pick<
  RiskListMetrics,
  "technical" | "operational" | "business"
> {
  let technical = 0;
  let operational = 0;
  let business = 0;
  for (const row of rows) {
    switch (row.primaryKey) {
      case "operational":
        operational += 1;
        break;
      case "business":
        business += 1;
        break;
      default:
        technical += 1;
    }
  }
  return { technical, operational, business };
}

export async function listRisks(): Promise<{
  risks: RiskDto[];
  metrics: RiskListMetrics;
}> {
  const rows = await db
    .select({
      id: risks.id,
      articleId: risks.articleId,
      riskTitle: risks.riskTitle,
      domains: risks.domains,
      primaryRisk: risks.primaryRisk,
      secondaryRisk: risks.secondaryRisk,
      sector: risks.sector,
      industry: risks.industry,
      intent: risks.intent,
      qualityScore: risks.qualityScore,
      extractionJson: risks.extractionJson,
      modelName: risks.modelName,
      sourceFlag: risks.sourceFlag,
      createdAt: risks.createdAt,
      articleTitle: articles.title,
      articleUrl: articles.url,
    })
    .from(risks)
    .innerJoin(articles, eq(risks.articleId, articles.id))
    .orderBy(desc(risks.createdAt));

  const displayIdByRiskId = buildRiskDisplayIdMap(
    rows.map((row) => ({ id: row.id, createdAt: row.createdAt })),
  );
  const mapped = rows.map((row) =>
    mapRiskRowToDto(row, displayIdByRiskId.get(row.id) ?? "R-?"),
  );
  const counts = countByPrimaryKey(mapped);

  return {
    risks: mapped,
    metrics: {
      total: mapped.length,
      ...counts,
    },
  };
}

export async function getRiskById(riskId: string): Promise<RiskDto> {
  const uuid = await resolveRiskUuid(riskId);
  if (!uuid) {
    throw HttpError.notFound("Risk not found.");
  }

  const [row] = await db
    .select({
      id: risks.id,
      articleId: risks.articleId,
      riskTitle: risks.riskTitle,
      domains: risks.domains,
      primaryRisk: risks.primaryRisk,
      secondaryRisk: risks.secondaryRisk,
      sector: risks.sector,
      industry: risks.industry,
      intent: risks.intent,
      qualityScore: risks.qualityScore,
      extractionJson: risks.extractionJson,
      modelName: risks.modelName,
      sourceFlag: risks.sourceFlag,
      createdAt: risks.createdAt,
      articleTitle: articles.title,
      articleUrl: articles.url,
    })
    .from(risks)
    .innerJoin(articles, eq(risks.articleId, articles.id))
    .where(eq(risks.id, uuid))
    .limit(1);

  if (!row) {
    throw HttpError.notFound("Risk not found.");
  }

  const orderRows = await db
    .select({ id: risks.id, createdAt: risks.createdAt })
    .from(risks);
  const displayId =
    buildRiskDisplayIdMap(orderRows).get(row.id) ?? "R-?";

  let extractionJson = row.extractionJson;
  let stored = parseCatalogMatchesFromExtraction(extractionJson);

  if (!stored) {
    const ext = (extractionJson ?? {}) as { risk?: Record<string, unknown> };
    const extractedRisk = ext.risk ?? {};
    const description = String(
      extractedRisk.description ?? row.riskTitle ?? "",
    ).trim();

    stored = await findCatalogRiskMatches({
      domain: row.domains ?? String(extractedRisk.domains ?? ""),
      title: row.riskTitle,
      description: description || row.riskTitle,
      primaryRisk: row.primaryRisk ?? undefined,
      secondaryRisk: row.secondaryRisk ?? undefined,
      limit: 5,
    });

    extractionJson = mergeCatalogMatchesIntoExtraction(
      (extractionJson ?? {}) as Record<string, unknown>,
      stored,
    );

    await db
      .update(risks)
      .set({ extractionJson, updatedAt: new Date() })
      .where(eq(risks.id, uuid));
  }

  return mapRiskRowToDto(
    { ...row, extractionJson },
    displayId,
  );
}

function reviewPriorityFromScore(score: number | null): ReviewQueueItemDto["priority"] {
  if (score == null) return "High";
  if (score < 50) return "High";
  if (score < 75) return "Medium";
  return "Low";
}

function formatScoreLabel(score: number | null): string {
  if (score == null) return "—/100";
  return `${Math.round(score)}/100`;
}

export async function listReviewQueueRisks(): Promise<{
  items: ReviewQueueItemDto[];
  total: number;
}> {
  const rows = await db
    .select({
      id: risks.id,
      articleId: risks.articleId,
      riskTitle: risks.riskTitle,
      domains: risks.domains,
      primaryRisk: risks.primaryRisk,
      secondaryRisk: risks.secondaryRisk,
      qualityScore: risks.qualityScore,
      extractionJson: risks.extractionJson,
      createdAt: risks.createdAt,
      articleUrl: articles.url,
    })
    .from(risks)
    .innerJoin(articles, eq(risks.articleId, articles.id))
    .orderBy(desc(risks.createdAt));

  const displayIdByRiskId = buildRiskDisplayIdMap(
    rows.map((row) => ({ id: row.id, createdAt: row.createdAt })),
  );

  const items: ReviewQueueItemDto[] = [];

  for (const row of rows) {
    const ext = (row.extractionJson ?? {}) as {
      risk?: Record<string, unknown>;
      review_status?: string;
    };
    const reviewStatus = String(ext.review_status ?? "")
      .trim()
      .toLowerCase();
    if (reviewStatus === "approved" || reviewStatus === "rejected") {
      continue;
    }

    const extractedRisk = ext.risk ?? {};
    const domain = String(row.domains ?? extractedRisk.domains ?? "").trim();

    const mapped = await isDomainMappedToCatalog(domain);
    if (mapped) continue;

    const score =
      row.qualityScore ??
      (typeof extractedRisk.quality_score === "number"
        ? extractedRisk.quality_score
        : null);

    items.push({
      id: row.id,
      displayId: displayIdByRiskId.get(row.id) ?? "R-?",
      title: row.riskTitle,
      domain: domain || "—",
      primaryRisk: row.primaryRisk ?? "—",
      secondaryRisk: row.secondaryRisk ?? "—",
      qualityScore: score,
      scoreLabel: formatScoreLabel(score),
      priority: reviewPriorityFromScore(score),
      category: [row.primaryRisk, domain].filter(Boolean).join(" · ") || "—",
      reviewReason:
        "Domain could not be mapped to the risk_mappings catalog in the database.",
      articleUrl: row.articleUrl,
      ingestedAt: row.createdAt.toISOString(),
    });
  }

  return { items, total: items.length };
}
