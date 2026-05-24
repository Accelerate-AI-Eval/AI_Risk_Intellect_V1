import { useEffect, useId, useState } from "react";
import {
  AlertTriangle,
  BarChart3,
  Brain,
  Eye,
  FileText,
  Sparkles,
  Target,
} from "lucide-react";
import { formatRiskDomain, formatRiskId, type RiskDetail } from "./riskData";
import "../Users/usersPage.css";
import "./riskDetailDialog.css";

export type RiskDetailTab = "overview" | "analysis" | "scores" | "evidence";

const TABS: { key: RiskDetailTab; label: string }[] = [
  { key: "overview", label: "Overview" },
  { key: "analysis", label: "Analysis" },
  { key: "scores", label: "Scores" },
  { key: "evidence", label: "Evidence" },
];

export function parseRiskDetailTab(value: string | null): RiskDetailTab | undefined {
  if (
    value === "overview" ||
    value === "analysis" ||
    value === "scores" ||
    value === "evidence"
  ) {
    return value;
  }
  return undefined;
}

type RiskDetailViewProps = {
  risk: RiskDetail;
  initialTab?: RiskDetailTab;
};

function confidenceLabel(level: RiskDetail["confidence"]): string {
  switch (level) {
    case "HIGH":
      return "HIGH CONFIDENCE";
    case "MEDIUM":
      return "MEDIUM CONFIDENCE";
    default:
      return "LOW CONFIDENCE";
  }
}

function scorePercent(value: number, max: number): number {
  if (max <= 0) return 0;
  return Math.min(100, Math.round((value / max) * 100));
}

function ScoreBar({ value, max }: { value: number; max: number }) {
  const pct = scorePercent(value, max);
  return (
    <div
      className="riskDetail__scoreBar"
      role="progressbar"
      aria-valuenow={value}
      aria-valuemin={0}
      aria-valuemax={max}
      aria-label={`${pct}%`}
    >
      <div className="riskDetail__scoreBarFill" style={{ width: `${pct}%` }} />
    </div>
  );
}

function DetailText({ children }: { children: string }) {
  const text = children.trim();
  if (!text) {
    return <p className="riskDetail__empty">No data available for this section.</p>;
  }
  return <p className="riskDetail__description">{text}</p>;
}

function AnalysisBlock({
  label,
  text,
}: {
  label: string;
  text: string;
}) {
  return (
    <div className="riskDetail__analysisBlock">
      <h4 className="riskDetail__analysisLabel">{label}</h4>
      <DetailText>{text}</DetailText>
    </div>
  );
}

export function RiskDetailView({ risk, initialTab = "overview" }: RiskDetailViewProps) {
  const baseId = useId();
  const [tab, setTab] = useState<RiskDetailTab>(initialTab);

  useEffect(() => {
    setTab(initialTab);
  }, [risk.id, initialTab]);

  const tabPanelId = `${baseId}-panel`;

  return (
    <div className="riskDetail riskDetail--page">
      <article
        className="riskDetail__shell"
        aria-labelledby={`${baseId}-title`}
      >
        <header className="riskDetail__header">
          <div className="riskDetail__headerMain">
            <h2 id={`${baseId}-title`} className="riskDetail__title">
              {risk.title}
            </h2>
            <p className="riskDetail__riskId">{formatRiskId(risk)}</p>
          </div>
          <div className="riskDetail__headerActions">
            <span
              className={`riskDetail__confidence riskDetail__confidence--${risk.confidence.toLowerCase()}`}
            >
              <Sparkles size={14} strokeWidth={2} aria-hidden />
              {confidenceLabel(risk.confidence)}
            </span>
            {risk.modelName ? (
              <span className="riskDetail__modelTag" title="Extraction model">
                {risk.modelName}
              </span>
            ) : null}
          </div>
        </header>

        <div className="riskDetail__tabBar">
          <div className="usersPage__tabs" role="tablist" aria-label="Risk detail sections">
            {TABS.map(({ key, label }) => (
              <button
                key={key}
                type="button"
                role="tab"
                id={`${baseId}-tab-${key}`}
                aria-selected={tab === key}
                aria-controls={tabPanelId}
                tabIndex={tab === key ? 0 : -1}
                className={`usersPage__tab${tab === key ? " usersPage__tab--selected" : ""}`}
                onClick={() => setTab(key)}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        <div
          id={tabPanelId}
          role="tabpanel"
          aria-labelledby={`${baseId}-tab-${tab}`}
          className="riskDetail__body"
        >
          {tab === "overview" ? (
            <>
              <section className="riskDetail__section" aria-labelledby={`${baseId}-source`}>
                <h3 id={`${baseId}-source`} className="riskDetail__sectionTitle">
                  <FileText size={16} strokeWidth={2} aria-hidden />
                  Source Article
                </h3>
                <dl className="riskDetail__fields">
                  <div className="riskDetail__field riskDetail__field--full">
                    <dt>Title</dt>
                    <dd>{risk.articleTitle}</dd>
                  </div>
                  <div className="riskDetail__field riskDetail__field--full">
                    <dt>URL</dt>
                    <dd>
                      <a
                        href={risk.articleUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="riskDetail__link"
                      >
                        {risk.articleUrl}
                      </a>
                    </dd>
                  </div>
                  <div className="riskDetail__field">
                    <dt>Ingested</dt>
                    <dd>{risk.ingestedAt}</dd>
                  </div>
                  <div className="riskDetail__field">
                    <dt>Quality score</dt>
                    <dd>{risk.qualityScore}</dd>
                  </div>
                </dl>
              </section>

              <section
                className="riskDetail__section"
                aria-labelledby={`${baseId}-classification`}
              >
                <h3 id={`${baseId}-classification`} className="riskDetail__sectionTitle">
                  <Target size={16} strokeWidth={2} aria-hidden />
                  Classification
                </h3>
                <dl className="riskDetail__classification">
                  <div className="riskDetail__field">
                    <dt>Domain</dt>
                    <dd>
                      <span className="riskDetail__pill">{formatRiskDomain(risk.domain)}</span>
                    </dd>
                  </div>
                  <div className="riskDetail__field">
                    <dt>Primary Risk</dt>
                    <dd>
                      <span className="riskDetail__pill">{risk.primaryRisk}</span>
                    </dd>
                  </div>
                  <div className="riskDetail__field">
                    <dt>Secondary Risk</dt>
                    <dd>
                      <span className="riskDetail__pill">{risk.secondaryRisk}</span>
                    </dd>
                  </div>
                  <div className="riskDetail__field">
                    <dt>Intent</dt>
                    <dd>
                      <span className="riskDetail__pill riskDetail__pill--intent">
                        {risk.intent}
                      </span>
                    </dd>
                  </div>
                </dl>
              </section>

              <section
                className="riskDetail__section"
                aria-labelledby={`${baseId}-description`}
              >
                <h3 id={`${baseId}-description`} className="riskDetail__sectionTitle">
                  Description
                </h3>
                <DetailText>{risk.description}</DetailText>
              </section>

              <div className="riskDetail__splitRow">
                <section
                  className="riskDetail__section riskDetail__section--split"
                  aria-labelledby={`${baseId}-attack`}
                >
                  <h3 id={`${baseId}-attack`} className="riskDetail__sectionTitle">
                    <AlertTriangle size={16} strokeWidth={2} aria-hidden />
                    Attack Vector
                  </h3>
                  <DetailText>{risk.attackVector}</DetailText>
                </section>
                <section
                  className="riskDetail__section riskDetail__section--split"
                  aria-labelledby={`${baseId}-indicators`}
                >
                  <h3 id={`${baseId}-indicators`} className="riskDetail__sectionTitle">
                    <Eye size={16} strokeWidth={2} aria-hidden />
                    Observable Indicators
                  </h3>
                  <DetailText>{risk.observableIndicators}</DetailText>
                </section>
              </div>

              <div className="riskDetail__metaRow">
                <section
                  className="riskDetail__section riskDetail__section--meta"
                  aria-labelledby={`${baseId}-sector`}
                >
                  <h3 id={`${baseId}-sector`} className="riskDetail__metaLabel">
                    Sector
                  </h3>
                  <p className="riskDetail__metaValue">{risk.sector}</p>
                </section>
                <section
                  className="riskDetail__section riskDetail__section--meta"
                  aria-labelledby={`${baseId}-industry`}
                >
                  <h3 id={`${baseId}-industry`} className="riskDetail__metaLabel">
                    Industry
                  </h3>
                  <p className="riskDetail__metaValue">{risk.industry}</p>
                </section>
                <section
                  className="riskDetail__section riskDetail__section--meta"
                  aria-labelledby={`${baseId}-timing`}
                >
                  <h3 id={`${baseId}-timing`} className="riskDetail__metaLabel">
                    Timing
                  </h3>
                  <p className="riskDetail__metaValue riskDetail__metaValue--block">
                    {risk.timing}
                  </p>
                </section>
              </div>
            </>
          ) : tab === "analysis" ? (
            <>
              <section
                className="riskDetail__section"
                aria-labelledby={`${baseId}-risk-analysis`}
              >
                <h3 id={`${baseId}-risk-analysis`} className="riskDetail__sectionTitle">
                  <Brain size={16} strokeWidth={2} aria-hidden />
                  Risk Analysis
                </h3>
                <div className="riskDetail__analysisStack">
                  <AnalysisBlock
                    label="Risk identified"
                    text={risk.riskAnalysis.risk_identified}
                  />
                  <AnalysisBlock
                    label="Article context"
                    text={risk.riskAnalysis.article_context}
                  />
                  <AnalysisBlock
                    label="Alignment reasoning"
                    text={risk.riskAnalysis.alignment_reasoning}
                  />
                </div>
              </section>

              <section
                className="riskDetail__section"
                aria-labelledby={`${baseId}-model-eval`}
              >
                <h3 id={`${baseId}-model-eval`} className="riskDetail__sectionTitle">
                  <BarChart3 size={16} strokeWidth={2} aria-hidden />
                  Model Self-Evaluation
                </h3>
                <AnalysisBlock
                  label="Decision rationale"
                  text={risk.modelSelfEvaluation.decision_rationale}
                />
              </section>
            </>
          ) : tab === "scores" ? (
            <>
              <section
                className="riskDetail__section riskDetail__section--overall"
                aria-labelledby={`${baseId}-overall-score`}
              >
                <div className="riskDetail__overallHead">
                  <h3 id={`${baseId}-overall-score`} className="riskDetail__overallLabel">
                    Overall Accuracy Score
                  </h3>
                  <div className="riskDetail__overallRight">
                    <p className="riskDetail__overallValue">
                      {risk.scores.overall.value}/{risk.scores.overall.max}
                    </p>
                    <p className="riskDetail__overallConfidence">
                      {confidenceLabel(risk.confidence)}
                    </p>
                  </div>
                </div>
                <ScoreBar
                  value={risk.scores.overall.value}
                  max={risk.scores.overall.max}
                />
              </section>

              <div className="riskDetail__scoresGrid">
                {risk.scores.metrics.map((metric) => (
                  <article
                    key={metric.label}
                    className="riskDetail__section riskDetail__scoreCard"
                  >
                    <div className="riskDetail__scoreCardHead">
                      <h3 className="riskDetail__scoreCardLabel">{metric.label}</h3>
                      <p className="riskDetail__scoreCardValue">
                        {metric.value}/{metric.max}
                      </p>
                    </div>
                    <ScoreBar value={metric.value} max={metric.max} />
                    {metric.reasoning?.trim() ? (
                      <p className="riskDetail__scoreCardReason">{metric.reasoning}</p>
                    ) : null}
                  </article>
                ))}
              </div>

              <section
                className="riskDetail__section"
                aria-labelledby={`${baseId}-score-justification`}
              >
                <h3
                  id={`${baseId}-score-justification`}
                  className="riskDetail__sectionTitle"
                >
                  Score Justification
                </h3>
                <div className="riskDetail__analysisStack">
                  <AnalysisBlock
                    label="Overall decision"
                    text={risk.scores.justification.decision_rationale}
                  />
                  <AnalysisBlock
                    label="Context clarity"
                    text={risk.scores.justification.context_clarity_reasoning ?? ""}
                  />
                  <AnalysisBlock
                    label="Keyword matching"
                    text={risk.scores.justification.keyword_reasoning ?? ""}
                  />
                  <AnalysisBlock
                    label="Tagging accuracy"
                    text={risk.scores.justification.tagging_reasoning ?? ""}
                  />
                  <AnalysisBlock
                    label="Evidence strength"
                    text={risk.scores.justification.evidence_reasoning ?? ""}
                  />
                </div>
              </section>
            </>
          ) : (
            <>
              <section
                className="riskDetail__section"
                aria-labelledby={`${baseId}-evidence-snippet`}
              >
                <h3 id={`${baseId}-evidence-snippet`} className="riskDetail__sectionTitle">
                  Evidence Snippet
                </h3>
                <p className="riskDetail__evidenceSnippet">
                  {risk.evidence.snippet.trim() || "No snippet available."}
                </p>
              </section>

              <section
                className="riskDetail__section"
                aria-labelledby={`${baseId}-evidence-sources`}
              >
                <h3 id={`${baseId}-evidence-sources`} className="riskDetail__sectionTitle">
                  Evidence Sources
                </h3>
                <DetailText>{risk.evidence.sources}</DetailText>
              </section>

              <section
                className="riskDetail__section"
                aria-labelledby={`${baseId}-evidence-data`}
              >
                <h3 id={`${baseId}-evidence-data`} className="riskDetail__sectionTitle">
                  Data to Identify Risk
                </h3>
                <DetailText>{risk.evidence.dataToIdentifyRisk}</DetailText>
              </section>

              <section
                className="riskDetail__section"
                aria-labelledby={`${baseId}-evidence-breakdown`}
              >
                <h3 id={`${baseId}-evidence-breakdown`} className="riskDetail__sectionTitle">
                  Evidence Breakdown
                </h3>
                {risk.evidence.breakdown.length === 0 ? (
                  <p className="riskDetail__empty">No structured evidence breakdown.</p>
                ) : (
                  <ul className="riskDetail__evidenceList">
                    {risk.evidence.breakdown.map((item, index) => (
                      <li key={`${item.field}-${index}`} className="riskDetail__evidenceItem">
                        <div className="riskDetail__evidenceItemHead">
                          <span className="riskDetail__pill">{item.field}</span>
                          {item.strength ? (
                            <span className="riskDetail__evidenceStrength">
                              {item.strength}
                            </span>
                          ) : null}
                        </div>
                        <p className="riskDetail__evidenceText">{item.sourceText}</p>
                        {item.specificity ? (
                          <p className="riskDetail__evidenceMeta">
                            Specificity: {item.specificity}
                          </p>
                        ) : null}
                        {item.taxonomyAlignment ? (
                          <p className="riskDetail__evidenceMeta">
                            Taxonomy alignment: {item.taxonomyAlignment}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </>
          )}
        </div>
      </article>
    </div>
  );
}
