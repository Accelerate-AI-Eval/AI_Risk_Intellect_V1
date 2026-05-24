import { eq, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { articles } from "../../schema/articles/articles.js";
import { risks } from "../../schema/risks/risks.js";
import {
  pythonExtractRisk,
  StubExtractionError,
  type RiskExtractionObject,
} from "../../extraction/pythonBridge.js";

export type ExtractRiskResult =
  | { outcome: "done"; riskId: string }
  | { outcome: "skipped"; reason: string };

function qualityScoreFromObject(obj: RiskExtractionObject): number | null {
  const score = obj.justification?.self_assessment?.total_score;
  if (typeof score === "number" && Number.isFinite(score)) {
    return Math.round(Math.max(0, Math.min(100, score)));
  }
  return null;
}

/**
 * Run LLM risk extraction on ingested article text and persist `risks` row.
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

    const risk = result.object.risk ?? {};
    const [row] = await db
      .insert(risks)
      .values({
        articleId: article.id,
        riskTitle: (risk.risk_title as string) || "Untitled risk",
        domains: (risk.domains as string) ?? null,
        primaryRisk: (risk.primary_risk as string) ?? null,
        secondaryRisk: (risk.secondary_risks as string) ?? null,
        sector: (risk.sector as string) ?? null,
        industry: (risk.industry as string) ?? null,
        intent: (risk.intent as string) ?? null,
        qualityScore: qualityScoreFromObject(result.object),
        extractionJson: result.object,
        modelName: result.model,
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

    return { outcome: "done", riskId: row!.id };
  } catch (err) {
    if (err instanceof StubExtractionError) {
      return {
        outcome: "skipped",
        reason:
          `${err.message}. Start Python (npm run py:dev) with USE_BEDROCK=true or a working LOCAL_MODEL_ID.`,
      };
    }
    throw err;
  }
}
