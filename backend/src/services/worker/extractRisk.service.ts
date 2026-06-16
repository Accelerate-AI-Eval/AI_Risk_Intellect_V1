import { eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles } from "../../schema/articles/articles.js";
import { risks } from "../../schema/risks/risks.js";
import {
  pythonExtractRisk,
  StubExtractionError,
  type RiskExtractionObject,
} from "../../extraction/pythonBridge.js";
import {
  findCatalogRiskMatches,
  mergeCatalogMatchesIntoExtraction,
} from "../risks/riskCatalogMatch.service.js";
import { recordObservabilityMetrics } from "../observability/observability.service.js";
import { withUsModelPrefix } from "../../utils/bedrockModelId.js";

export type ExtractRiskResult =
  | { outcome: "done"; riskId: string; created: boolean }
  | { outcome: "skipped"; reason: string };

const UNKNOWN_MODEL_KEY = "__unknown__";

/** Normalize model id for comparison (case-insensitive, trimmed, with `us.` prefix). */
export function normalizeModelKey(modelName: string | null | undefined): string {
  const key = withUsModelPrefix(modelName ?? "").toLowerCase();
  return key || UNKNOWN_MODEL_KEY;
}

function displayModelName(modelName: string): string {
  return withUsModelPrefix(modelName);
}

async function findExistingRiskForArticleModel(
  articleId: number,
  modelKey: string,
): Promise<{ id: string; modelName: string | null } | null> {
  const rows = await db
    .select({ id: risks.id, modelName: risks.modelName })
    .from(risks)
    .where(eq(risks.articleId, articleId));

  for (const row of rows) {
    if (normalizeModelKey(row.modelName) === modelKey) {
      return row;
    }
  }
  return null;
}

function qualityScoreFromObject(obj: RiskExtractionObject): number | null {
  const score = obj.justification?.self_assessment?.total_score;
  if (typeof score === "number" && Number.isFinite(score)) {
    return Math.round(Math.max(0, Math.min(100, score)));
  }
  return null;
}

/**
 * Run LLM risk extraction on ingested article text and persist `risks` row.
 * At most one risk per (article, model). Re-runs with the same model return the
 * existing risk without inserting a duplicate.
 * Stub/fallback extractions return `skipped` (not persisted).
 */
export async function extractRiskForArticle(
  articleId: number,
): Promise<ExtractRiskResult> {
  const [article] = await db
    .select({
      id: articles.id,
      url: articles.url,
      title: articles.title,
      rawText: articles.rawText,
    })
    .from(articles)
    .where(eq(articles.id, articleId))
    .limit(1);

  if (!article) {
    return { outcome: "skipped", reason: "article not found" };
  }

  const text = article.rawText?.trim() ?? "";
  if (!text) {
    return { outcome: "skipped", reason: "no article text for extraction" };
  }

  try {
    const result = await pythonExtractRisk({
      text,
      title: article.title ?? "",
      url: article.url,
    });

    const resolvedModel = displayModelName(result.model);
    const modelKey = normalizeModelKey(resolvedModel);
    const existing = await findExistingRiskForArticleModel(articleId, modelKey);

    await recordObservabilityMetrics({
      modelName: resolvedModel,
      url: article.url,
      wordCount:
        result.metrics.word_count > 0
          ? result.metrics.word_count
          : text.split(/\s+/).filter(Boolean).length,
      tokensGenerated: result.metrics.tokens_generated,
      durationMs: result.metrics.duration_ms,
    });

    if (existing) {
      return {
        outcome: "done",
        riskId: existing.id,
        created: false,
      };
    }

    const risk = result.object.risk ?? {};
    const riskTitle = (risk.risk_title as string) || "Untitled risk";
    const domains = (risk.domains as string) ?? null;
    const description = String(risk.description ?? "").trim();

    const catalogMatches = await findCatalogRiskMatches({
      domain: domains ?? "",
      title: riskTitle,
      description: description || riskTitle,
      primaryRisk: (risk.primary_risk as string) ?? undefined,
      secondaryRisk: (risk.secondary_risks as string) ?? undefined,
      limit: 5,
    });

    const extractionJson = mergeCatalogMatchesIntoExtraction(
      result.object as Record<string, unknown>,
      catalogMatches,
    );

    const [row] = await db
      .insert(risks)
      .values({
        articleId: article.id,
        riskTitle,
        domains,
        primaryRisk: (risk.primary_risk as string) ?? null,
        secondaryRisk: (risk.secondary_risks as string) ?? null,
        sector: (risk.sector as string) ?? null,
        industry: (risk.industry as string) ?? null,
        intent: (risk.intent as string) ?? null,
        qualityScore: qualityScoreFromObject(result.object),
        extractionJson,
        modelName: resolvedModel,
        sourceFlag: result.sourceFlag,
      })
      .returning({ id: risks.id });

    await db
      .update(articles)
      .set({
        riskCount: sql`${articles.riskCount} + 1`,
        updatedAt: new Date(),
      })
      .where(eq(articles.id, articleId));

    return { outcome: "done", riskId: row!.id, created: true };
  } catch (err) {
    if (err instanceof StubExtractionError) {
      const hasBedrockDetail = /bedrock error/i.test(err.message);
      return {
        outcome: "skipped",
        reason: hasBedrockDetail
          ? err.message
          : `${err.message}. Start Python (npm run py:dev) with USE_BEDROCK=true or a working LOCAL_MODEL_ID.`,
      };
    }
    throw err;
  }
}
