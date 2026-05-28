import { normalizeNarrativeText } from "../../utils/normalizeNarrativeText.js";
import { parseCatalogMatchesFromExtraction } from "./riskCatalogMatch.service.js";

export type EvidenceBreakdownItem = {
  field: string;
  strength: string;
  sourceText: string;
  specificity?: string;
  taxonomyAlignment?: string;
};

export type ReviewQueueItemDto = {
  id: string;
  displayId: string;
  title: string;
  domain: string;
  primaryRisk: string;
  secondaryRisk: string;
  qualityScore: number | null;
  scoreLabel: string;
  priority: "Low" | "Medium" | "High";
  category: string;
  reviewReason: string;
  articleUrl: string;
  ingestedAt: string;
};

export type CatalogRiskMatchDto = {
  riskId: string;
  title: string;
  description: string;
  domain: string;
  accuracyPercent: number;
  domainMatchPercent: number;
  descriptionMatchPercent: number;
  matchSummary: string;
};

export type RiskDto = {
  id: string;
  /** Sequential display id (R-1, R-01, R-10, …). */
  displayId: string;
  title: string;
  domain: string;
  primaryRisk: string;
  secondaryRisk: string;
  sector: string;
  industry: string;
  intent: string;
  qualityScore: string;
  primaryKey: string;
  tagKey: string;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  description: string;
  attackVector: string;
  observableIndicators: string;
  timing: string;
  articleId: number;
  articleTitle: string;
  articleUrl: string;
  ingestedAt: string;
  modelName: string | null;
  riskAnalysis: {
    risk_identified: string;
    article_context: string;
    alignment_reasoning: string;
    /** Top catalog matches from `risk_mappings` (detail view only). */
    catalogMatches: CatalogRiskMatchDto[];
  };
  modelSelfEvaluation: {
    decision_rationale: string;
  };
  scores: {
    overall: { value: number; max: number };
    metrics: {
      label: string;
      value: number;
      max: number;
      reasoning?: string;
    }[];
    justification: {
      decision_rationale: string;
      context_clarity_reasoning?: string;
      keyword_reasoning?: string;
      tagging_reasoning?: string;
      evidence_reasoning?: string;
    };
  };
  evidence: {
    snippet: string;
    sources: string;
    dataToIdentifyRisk: string;
    breakdown: EvidenceBreakdownItem[];
  };
};

type ExtractionJson = {
  risk?: Record<string, unknown>;
  analysis?: Record<string, unknown>;
  justification?: {
    self_assessment?: Record<string, unknown>;
    decision_rationale?: string;
    evidence_breakdown?: Array<Record<string, unknown>>;
  };
  controls?: Array<Record<string, unknown>>;
  /** Catalog `risk_mappings` IDs matched at extraction time. */
  catalog_matches?: unknown[];
};

type RiskRowInput = {
  id: string;
  articleId: number;
  riskTitle: string;
  domains: string | null;
  primaryRisk: string | null;
  secondaryRisk: string | null;
  sector: string | null;
  industry: string | null;
  intent: string | null;
  qualityScore: number | null;
  extractionJson: unknown;
  modelName: string | null;
  createdAt: Date;
  articleTitle: string | null;
  articleUrl: string;
};

function str(v: unknown, fallback = ""): string {
  if (v == null) return fallback;
  return String(v).trim();
}

/** Full narrative text for UI — never word-capped; strips only a trailing fragment. */
function narrative(v: unknown, fallback = ""): string {
  const raw = str(v, fallback);
  if (!raw) return raw;
  return normalizeNarrativeText(raw);
}

function primaryKeyFromLabel(primary: string): string {
  const l = primary.toLowerCase();
  if (l.includes("operational")) return "operational";
  if (l.includes("business")) return "business";
  return "technical";
}

function tagKeyFromDomain(domain: string): string {
  const d = domain.toLowerCase();
  if (d.includes("discrimination") || d.includes("toxicity")) return "bias";
  if (d.includes("privacy") || d.includes("security")) return "privacy";
  if (d.includes("safety") || d.includes("failure")) return "safety";
  return "general";
}

function confidenceFromScore(
  score: number | null,
  level?: string,
): RiskDto["confidence"] {
  const lvl = (level ?? "").toLowerCase();
  if (lvl === "high") return "HIGH";
  if (lvl === "medium") return "MEDIUM";
  if (lvl === "low") return "LOW";
  if (score == null) return "MEDIUM";
  if (score >= 85) return "HIGH";
  if (score >= 65) return "MEDIUM";
  return "LOW";
}

function formatQualityScore(score: number | null): string {
  if (score == null) return "—";
  if (score <= 1) return score.toFixed(2);
  return (score / 100).toFixed(2);
}

function mapEvidenceBreakdown(
  items: Array<Record<string, unknown>>,
): EvidenceBreakdownItem[] {
  return items
    .map((item) => ({
      field: str(item.field, "Evidence"),
      strength: str(item.strength),
      sourceText: narrative(item.source_text),
      specificity: str(item.specificity) || undefined,
      taxonomyAlignment: str(item.taxonomy_alignment) || undefined,
    }))
    .filter((item) => item.sourceText.length > 0);
}

export function mapRiskRowToDto(
  row: RiskRowInput,
  displayId: string,
): RiskDto {
  const ext = (row.extractionJson ?? {}) as ExtractionJson;
  const catalogMatches = (parseCatalogMatchesFromExtraction(ext) ?? []).map(
    (match) => ({
      ...match,
      description: narrative(match.description, "No description available."),
      matchSummary: narrative(match.matchSummary),
    }),
  );
  const risk = ext.risk ?? {};
  const analysis = ext.analysis ?? {};
  const justification = ext.justification ?? {};
  const self = justification.self_assessment ?? {};

  const domain = str(row.domains ?? risk.domains, "—");
  const primaryRisk = str(row.primaryRisk ?? risk.primary_risk, "—");
  const secondaryRisk = str(row.secondaryRisk ?? risk.secondary_risks, "—");
  const quality = row.qualityScore ?? Number(self.total_score) ?? null;

  const description = narrative(risk.description);

  const scoreMetrics: RiskDto["scores"]["metrics"] = [
    {
      label: "Context Clarity",
      value: Number(self.context_clarity_score ?? 0),
      max: 45,
      reasoning: narrative(self.context_clarity_reasoning),
    },
    {
      label: "Keyword Matching",
      value: Number(self.keyword_score ?? 0),
      max: 20,
      reasoning: narrative(self.keyword_reasoning),
    },
    {
      label: "Tagging Accuracy",
      value: Number(self.tagging_accuracy_score ?? 0),
      max: 20,
      reasoning: narrative(self.tagging_reasoning),
    },
    {
      label: "Evidence Strength",
      value: Number(self.evidence_strength_score ?? 0),
      max: 15,
      reasoning: narrative(self.evidence_reasoning),
    },
  ];

  const evidenceBreakdown = mapEvidenceBreakdown(
    justification.evidence_breakdown ?? [],
  );
  const firstEvidence = evidenceBreakdown[0];

  const decisionRationale = narrative(
    self.decision_rationale ?? justification.decision_rationale,
  );

  return {
    id: row.id,
    displayId,
    title: str(row.riskTitle ?? risk.risk_title, "Untitled risk"),
    domain,
    primaryRisk,
    secondaryRisk,
    sector: str(row.sector ?? risk.sector, "—"),
    industry: str(row.industry ?? risk.industry, "—"),
    intent: str(row.intent ?? risk.intent, "—"),
    qualityScore: formatQualityScore(
      typeof quality === "number" && !Number.isNaN(quality) ? quality : null,
    ),
    primaryKey: primaryKeyFromLabel(primaryRisk),
    tagKey: tagKeyFromDomain(domain),
    confidence: confidenceFromScore(
      typeof quality === "number" && !Number.isNaN(quality) ? quality : null,
      str(self.confidence_level),
    ),
    description,
    attackVector: narrative(risk.attack_vector),
    observableIndicators: narrative(risk.observable_indicators),
    timing: narrative(risk.timing),
    articleId: row.articleId,
    articleTitle: str(row.articleTitle, row.articleUrl),
    articleUrl: row.articleUrl,
    ingestedAt: row.createdAt.toISOString(),
    modelName: row.modelName,
    riskAnalysis: {
      risk_identified: narrative(analysis.risk_identified),
      article_context: narrative(analysis.article_context),
      alignment_reasoning: narrative(analysis.alignment_reasoning),
      catalogMatches,
    },
    modelSelfEvaluation: {
      decision_rationale: decisionRationale,
    },
    scores: {
      overall: {
        value: Number(quality ?? self.total_score ?? 0),
        max: 100,
      },
      metrics: scoreMetrics,
      justification: {
        decision_rationale: decisionRationale,
        context_clarity_reasoning: narrative(self.context_clarity_reasoning),
        keyword_reasoning: narrative(self.keyword_reasoning),
        tagging_reasoning: narrative(self.tagging_reasoning),
        evidence_reasoning: narrative(self.evidence_reasoning),
      },
    },
    evidence: {
      snippet: narrative(firstEvidence?.sourceText ?? description),
      sources: narrative(risk.evidence_sources),
      dataToIdentifyRisk: narrative(risk.data_to_identify_risk),
      breakdown: evidenceBreakdown,
    },
  };
}
