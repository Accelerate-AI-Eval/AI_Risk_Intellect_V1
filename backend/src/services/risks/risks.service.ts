import { asc, desc, eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles } from "../../schema/articles/articles.js";
import { risks } from "../../schema/risks/risks.js";
import { HttpError } from "../../utils/httpError.js";
import { parseRiskDisplaySequence } from "./riskDisplayId.js";
import { mapRiskRowToDto, type RiskDto } from "./riskDto.js";
import {
  buildRiskDisplayIdMap,
  sortRisksForDisplaySequence,
} from "./riskSequence.js";

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

async function resolveRiskUuid(idOrDisplayId: string): Promise<string | null> {
  const trimmed = idOrDisplayId.trim();
  if (/^[0-9a-f-]{36}$/i.test(trimmed)) return trimmed;

  const sequence = parseRiskDisplaySequence(trimmed);
  if (sequence == null) return null;

  const orderRows = await db
    .select({ id: risks.id, createdAt: risks.createdAt })
    .from(risks)
    .orderBy(asc(risks.createdAt), asc(risks.id));

  if (sequence < 1 || sequence > orderRows.length) return null;
  return sortRisksForDisplaySequence(orderRows)[sequence - 1]!.id;
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

  return mapRiskRowToDto(row, displayId);
}
