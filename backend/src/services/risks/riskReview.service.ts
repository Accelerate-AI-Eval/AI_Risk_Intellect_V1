import { eq } from "drizzle-orm";
import { db } from "../../db/index.js";
import { riskMappings } from "../../schema/riskMappings/riskMappings.js";
import { risks } from "../../schema/risks/risks.js";
import { HttpError } from "../../utils/httpError.js";
import { invalidateCatalogCache } from "./riskCatalogMatch.service.js";
import { resolveRiskUuid } from "./riskResolve.js";

function truncate(value: string | null | undefined, max: number): string | null {
  if (value == null) return null;
  const trimmed = String(value).trim();
  if (!trimmed) return null;
  return trimmed.length <= max ? trimmed : `${trimmed.slice(0, max - 1)}…`;
}

async function allocateNextCatalogRiskId(): Promise<string> {
  const rows = await db
    .select({ riskId: riskMappings.riskId })
    .from(riskMappings);

  let maxNum = 0;
  for (const row of rows) {
    const match = /^RISK-(\d+)$/i.exec((row.riskId ?? "").trim());
    if (match) {
      maxNum = Math.max(maxNum, Number.parseInt(match[1]!, 10));
    }
  }
  return `RISK-${maxNum + 1}`;
}

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v).trim();
}

export type ApproveReviewResult = {
  catalogRiskId: string;
  riskMappingId: number;
};

export type ApproveReviewOptions = {
  /** Override domain from reviewer (taxonomy pick or custom). */
  domain?: string;
};

/**
 * Approve a review-queue risk: insert into `risk_mappings` and mark the risk approved.
 */
export async function approveReviewRisk(
  riskIdOrDisplayId: string,
  options?: ApproveReviewOptions,
): Promise<ApproveReviewResult> {
  const uuid = await resolveRiskUuid(riskIdOrDisplayId);
  if (!uuid) {
    throw HttpError.notFound("Risk not found.");
  }

  const [row] = await db
    .select({
      id: risks.id,
      riskTitle: risks.riskTitle,
      domains: risks.domains,
      primaryRisk: risks.primaryRisk,
      secondaryRisk: risks.secondaryRisk,
      intent: risks.intent,
      extractionJson: risks.extractionJson,
    })
    .from(risks)
    .where(eq(risks.id, uuid))
    .limit(1);

  if (!row) {
    throw HttpError.notFound("Risk not found.");
  }

  const ext = (row.extractionJson ?? {}) as Record<string, unknown>;
  const reviewStatus = str(ext.review_status).toLowerCase();
  if (reviewStatus === "approved") {
    throw HttpError.conflict("This risk has already been approved.");
  }

  const risk = (ext.risk ?? {}) as Record<string, unknown>;
  const analysis = (ext.analysis ?? {}) as Record<string, unknown>;

  const domain = str(options?.domain ?? row.domains ?? risk.domains);
  if (!domain) {
    throw HttpError.unprocessable(
      "Select a taxonomy domain or enter a custom domain before approving.",
    );
  }

  const catalogRiskId = await allocateNextCatalogRiskId();
  const description = str(risk.description);
  const executiveSummary =
    str(analysis.risk_identified) ||
    str(analysis.alignment_reasoning) ||
    description.slice(0, 500);

  const [inserted] = await db
    .insert(riskMappings)
    .values({
      riskId: catalogRiskId,
      riskTitle: truncate(row.riskTitle, 255),
      domains: truncate(domain, 255),
      description: description || null,
      technicalDescription: description || null,
      executiveSummary: executiveSummary || null,
      attackVector: truncate(str(risk.attack_vector), 255),
      observableIndicators: str(risk.observable_indicators) || null,
      dataToIdentifyRisk: str(risk.data_to_identify_risk) || null,
      evidenceSources: str(risk.evidence_sources) || null,
      intent: truncate(str(row.intent ?? risk.intent), 255),
      timing: truncate(str(risk.timing), 255),
      riskTypeDetected: truncate(str(risk.risk_type_detected), 255),
      primaryRisk: truncate(str(row.primaryRisk ?? risk.primary_risk), 255),
      secondaryRisks: truncate(str(row.secondaryRisk ?? risk.secondary_risks), 255),
    })
    .returning({
      riskMappingId: riskMappings.riskMappingId,
      riskId: riskMappings.riskId,
    });

  invalidateCatalogCache();

  const updatedExtraction: Record<string, unknown> = {
    ...ext,
    review_status: "approved",
    catalog_risk_id: catalogRiskId,
    approved_at: new Date().toISOString(),
  };

  await db
    .update(risks)
    .set({
      domains: truncate(domain, 255),
      extractionJson: updatedExtraction,
      updatedAt: new Date(),
    })
    .where(eq(risks.id, uuid));

  return {
    catalogRiskId: inserted!.riskId ?? catalogRiskId,
    riskMappingId: inserted!.riskMappingId,
  };
}
