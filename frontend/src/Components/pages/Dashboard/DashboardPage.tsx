import { useCallback, useEffect, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  Activity,
  AlertTriangle,
  Building2,
  Briefcase,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  ExternalLink,
  FileText,
  Heart,
  Info,
  Landmark,
  Layers,
  LineChart,
  Link2,
  Network,
  RefreshCw,
  Shield,
  Target,
  TrendingDown,
  TrendingUp,
  Zap,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { MetricSparkline } from "./MetricSparkline";
import { PageHeader } from "../../Layout/PageHeader";
import { setDocumentPageTitle } from "../../../utils/pageTitle";
import "../Users/usersPage.css";
import "./dashboardPage.css";

type ChangeTrend = "up" | "down" | "neutral";

type MetricConfig = {
  key: string;
  title: string;
  value: string;
  accent: "blue" | "orange" | "green" | "slate" | "zinc";
  Icon: LucideIcon;
  sparkPoints: number[];
  trend: ChangeTrend;
  changePct: string;
  changeAbs: string;
  footer: string;
};

const METRICS: MetricConfig[] = [
  {
    key: "articles",
    title: "Total articles",
    value: "126",
    accent: "blue",
    Icon: FileText,
    sparkPoints: [12, 18, 22, 35, 48, 52, 68, 74, 82, 95, 110, 126],
    trend: "up",
    changePct: "0.0%",
    changeAbs: "+126",
    footer: "Previous: 0",
  },
  {
    key: "risks",
    title: "Risks mapped",
    value: "0",
    accent: "orange",
    Icon: Shield,
    sparkPoints: [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0],
    trend: "neutral",
    changePct: "0.0%",
    changeAbs: "0",
    footer: "Previous: 0",
  },
  {
    key: "success",
    title: "Success rate",
    value: "0%",
    accent: "green",
    Icon: CheckCircle2,
    sparkPoints: [42, 38, 40, 35, 32, 28, 30, 26, 22, 18, 12, 8],
    trend: "neutral",
    changePct: "0.0%",
    changeAbs: "0",
    footer: "Previous: 0",
  },
  {
    key: "activity",
    title: "24h activity",
    value: "0",
    accent: "slate",
    Icon: Activity,
    sparkPoints: [2, 4, 3, 6, 8, 7, 9, 11, 10, 12, 11, 14],
    trend: "neutral",
    changePct: "0.0%",
    changeAbs: "0",
    footer: "~0.0/hour avg",
  },
  {
    key: "avgTime",
    title: "Avg processing time",
    value: "0s",
    accent: "zinc",
    Icon: Clock,
    sparkPoints: [20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20, 20],
    trend: "down",
    changePct: "-10.0%",
    changeAbs: "0",
    footer: "10% faster",
  },
  {
    key: "queue",
    title: "Pending queue",
    value: "0",
    accent: "zinc",
    Icon: Zap,
    sparkPoints: [28, 26, 24, 22, 18, 16, 14, 12, 10, 8, 6, 4],
    trend: "down",
    changePct: "-25.0%",
    changeAbs: "-10",
    footer: "Est. 0min to clear",
  },
];

const ACCENT_COLORS: Record<MetricConfig["accent"], string> = {
  blue: "#3B82F6",
  orange: "#F59E0B",
  green: "#10B981",
  slate: "#64748b",
  zinc: "#64748b",
};

const SEVERITY_ROWS = [
  {
    key: "low",
    label: "Low",
    color: "#22c55e",
    pct: "45%",
    count: "2,139",
    delta: "+247",
    deltaPct: "(13.1%)",
    trend: "up" as const,
  },
  {
    key: "medium",
    label: "Medium",
    color: "#eab308",
    pct: "37%",
    count: "1,756",
    delta: "-78",
    deltaPct: "(-4.3%)",
    trend: "down" as const,
  },
  {
    key: "high",
    label: "High",
    color: "#f97316",
    pct: "13%",
    count: "632",
    delta: "+43",
    deltaPct: "(7.3%)",
    trend: "up" as const,
  },
  {
    key: "critical",
    label: "Critical",
    color: "#ef4444",
    pct: "4%",
    count: "189",
    delta: "-23",
    deltaPct: "(-10.8%)",
    trend: "down" as const,
  },
];

const CONFIDENCE_BREAKDOWN = [
  { key: "hi", label: "High (>90%)", count: "2,847", tone: "green" as const },
  { key: "mid", label: "Medium (70-90%)", count: "892", tone: "amber" as const },
  { key: "lo", label: "Low (<70%)", count: "153", tone: "red" as const },
];

const ANALYSIS_CONFIDENCE_PCT = 87.4;

/** Mock 8 weeks × 7 days — replace when activity API is wired */
const WEEKLY_RISK_HEATMAP_ROWS: {
  label: string;
  values: readonly [number, number, number, number, number, number, number];
  emphasizeTotal?: boolean;
}[] = [
  {
    label: "This Week",
    values: [34, 28, 42, 19, 45, 36, 46],
    emphasizeTotal: true,
  },
  {
    label: "Last Week",
    values: [26, 27, 30, 28, 25, 22, 20],
  },
  {
    label: "3 weeks ago",
    values: [21, 19, 26, 22, 20, 24, 24],
  },
  {
    label: "4 weeks ago",
    values: [21, 22, 23, 24, 25, 22, 24],
  },
  {
    label: "5 weeks ago",
    values: [18, 17, 21, 22, 23, 24, 24],
  },
  {
    label: "6 weeks ago",
    values: [24, 26, 27, 23, 22, 21, 21],
  },
  {
    label: "7 weeks ago",
    values: [22, 21, 25, 23, 22, 23, 22],
  },
  {
    label: "8 weeks ago",
    values: [26, 24, 25, 24, 23, 22, 20],
  },
];

const HEATMAP_DAY_LABELS = ["S", "M", "T", "W", "T", "F", "S"] as const;

function weeklyRiskHeatLevel(value: number): 0 | 1 | 2 | 3 | 4 {
  if (value <= 14) return 0;
  if (value <= 23) return 1;
  if (value <= 34) return 2;
  if (value <= 42) return 3;
  return 4;
}

function WeeklyRiskActivityHeatmap() {
  const rows = useMemo(
    () =>
      WEEKLY_RISK_HEATMAP_ROWS.map((row) => ({
        ...row,
        total: row.values.reduce((a, b) => a + b, 0),
      })),
    [],
  );

  const grandTotal = useMemo(
    () => rows.reduce((sum, r) => sum + r.total, 0),
    [rows],
  );

  const avgPerWeek = useMemo(() => {
    if (rows.length === 0) return 0;
    return Math.round(grandTotal / rows.length);
  }, [grandTotal, rows.length]);

  return (
    <article
      className="dashHeatmap"
      aria-labelledby="dash-heatmap-title"
    >
      <header className="dashHeatmap__header">
        <h3 id="dash-heatmap-title" className="dashHeatmap__title">
          <CalendarDays
            size={17}
            strokeWidth={2}
            className="dashHeatmap__titleIcon"
            aria-hidden
          />
          Weekly risk activity
        </h3>
        <div className="dashHeatmap__stats">
          <p className="dashHeatmap__stat">
            Avg:{" "}
            <span className="dashHeatmap__statValue">{avgPerWeek}/week</span>
          </p>
          <p className="dashHeatmap__stat">
            Total:{" "}
            <span className="dashHeatmap__statValue">{grandTotal}</span>
          </p>
        </div>
      </header>

      <div className="dashHeatmap__tableWrap">
        <table className="dashHeatmap__table">
          <thead>
            <tr>
              <th className="dashHeatmap__th dashHeatmap__th--corner" scope="col">
                <span className="dashHeatmap__srOnly">Week</span>
              </th>
              {HEATMAP_DAY_LABELS.map((d, i) => (
                <th key={`${d}-${i}`} className="dashHeatmap__th" scope="col">
                  {d}
                </th>
              ))}
              <th className="dashHeatmap__th dashHeatmap__th--total" scope="col">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label}>
                <th className="dashHeatmap__rowLabel" scope="row">
                  {row.label}
                </th>
                {row.values.map((v, i) => {
                  const lvl = weeklyRiskHeatLevel(v);
                  return (
                    <td key={i} className="dashHeatmap__td">
                      <span
                        className={`dashHeatmap__cell dashHeatmap__cell--${lvl}`}
                      >
                        {v}
                      </span>
                    </td>
                  );
                })}
                <td className="dashHeatmap__td dashHeatmap__td--total">
                  <span
                    className={
                      row.emphasizeTotal
                        ? "dashHeatmap__total dashHeatmap__total--high"
                        : "dashHeatmap__total"
                    }
                  >
                    {row.total}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <footer className="dashHeatmap__footer">
        <div className="dashHeatmap__legend" aria-hidden>
          <span className="dashHeatmap__legendLabel">Less</span>
          <span className="dashHeatmap__legendSwatches">
            <span className="dashHeatmap__swatch dashHeatmap__swatch--0" />
            <span className="dashHeatmap__swatch dashHeatmap__swatch--1" />
            <span className="dashHeatmap__swatch dashHeatmap__swatch--2" />
            <span className="dashHeatmap__swatch dashHeatmap__swatch--3" />
            <span className="dashHeatmap__swatch dashHeatmap__swatch--4" />
          </span>
          <span className="dashHeatmap__legendLabel">More</span>
        </div>
        <p className="dashHeatmap__caption">
          Risk activity by day over the past 8 weeks
        </p>
      </footer>
    </article>
  );
}

type TaxonomyDomain = {
  key: string;
  order: number;
  label: string;
  color: string;
  count: number;
};

const TAXONOMY_DOMAINS: TaxonomyDomain[] = [
  {
    key: "discrimination",
    order: 1,
    label: "Discrimination & Toxicity",
    color: "#ef4444",
    count: 0,
  },
  {
    key: "privacy",
    order: 2,
    label: "Privacy & Security",
    color: "#a855f7",
    count: 0,
  },
  {
    key: "misinformation",
    order: 3,
    label: "Misinformation",
    color: "#f97316",
    count: 0,
  },
  {
    key: "malicious",
    order: 4,
    label: "Malicious Actors",
    color: "#fb7185",
    count: 0,
  },
  {
    key: "hci",
    order: 5,
    label: "Human-Computer Interaction",
    color: "#38bdf8",
    count: 0,
  },
  {
    key: "socioeconomic",
    order: 6,
    label: "Socioeconomic & Environmental",
    color: "#22c55e",
    count: 0,
  },
  {
    key: "ai_safety",
    order: 7,
    label: "AI System Safety, Failures, & Limitations",
    color: "#8b5cf6",
    count: 0,
  },
];

/** Placeholder until articles / sector API is wired */
const SECTOR_ARTICLE_TOTAL = 0;
const SECTOR_COUNTS = {
  private: 0,
  public: 0,
  nonprofit: 0,
} as const;

function sectorPct(count: number, total: number): string {
  if (total <= 0) return "0";
  return ((count / total) * 100).toFixed(1);
}

function SectorIndustryPanel() {
  const total = SECTOR_ARTICLE_TOTAL;
  const pctPrivate = sectorPct(SECTOR_COUNTS.private, total);
  const pctPublic = sectorPct(SECTOR_COUNTS.public, total);
  const pctNonprofit = sectorPct(SECTOR_COUNTS.nonprofit, total);

  const industryColumns = [
    {
      key: "private" as const,
      title: "Top private industries",
      dotClass: "dashSectorList__dot--private",
    },
    {
      key: "public" as const,
      title: "Top public industries",
      dotClass: "dashSectorList__dot--public",
    },
    {
      key: "nonprofit" as const,
      title: "Top non-profit industries",
      dotClass: "dashSectorList__dot--nonprofit",
    },
  ];

  return (
    <article className="dashSector" aria-labelledby="dash-sector-title">
      <header className="dashSector__header">
        <h2 id="dash-sector-title" className="dashSector__title">
          <Building2
            size={18}
            strokeWidth={2}
            className="dashSector__titleIcon"
            aria-hidden
          />
          Sector &amp; industry analysis
        </h2>
        <p className="dashSector__total">
          Total:{" "}
          <span className="dashSector__totalValue">{total}</span> articles
        </p>
      </header>

      <div className="dashSector__cards">
        <div className="dashSectorCard dashSectorCard--private">
          <div className="dashSectorCard__head">
            <span className="dashSectorCard__label">Private sector</span>
            <span className="dashSectorCard__iconWrap" aria-hidden>
              <Briefcase size={20} strokeWidth={2} />
            </span>
          </div>
          <p className="dashSectorCard__value">{SECTOR_COUNTS.private}</p>
          <p className="dashSectorCard__sub">{pctPrivate}% of total</p>
        </div>
        <div className="dashSectorCard dashSectorCard--public">
          <div className="dashSectorCard__head">
            <span className="dashSectorCard__label">Public sector</span>
            <span className="dashSectorCard__iconWrap" aria-hidden>
              <Landmark size={20} strokeWidth={2} />
            </span>
          </div>
          <p className="dashSectorCard__value">{SECTOR_COUNTS.public}</p>
          <p className="dashSectorCard__sub">{pctPublic}% of total</p>
        </div>
        <div className="dashSectorCard dashSectorCard--nonprofit">
          <div className="dashSectorCard__head">
            <span className="dashSectorCard__label">Non-profit sector</span>
            <span className="dashSectorCard__iconWrap" aria-hidden>
              <Heart size={20} strokeWidth={2} />
            </span>
          </div>
          <p className="dashSectorCard__value">{SECTOR_COUNTS.nonprofit}</p>
          <p className="dashSectorCard__sub">{pctNonprofit}% of total</p>
        </div>
      </div>

      <div className="dashSector__lists">
        {industryColumns.map((col) => (
          <div key={col.key} className="dashSectorList">
            <h3 className="dashSectorList__title">
              <span className={`dashSectorList__dot ${col.dotClass}`} aria-hidden />
              {col.title}
            </h3>
            <div className="dashSectorList__body" role="status">
              <p className="dashSectorList__empty">No industries ranked yet.</p>
            </div>
          </div>
        ))}
      </div>

      <footer className="dashSector__foot">
        <ExternalLink size={14} strokeWidth={2} className="dashSector__footIcon" aria-hidden />
        <p>Click any industry for detailed deep dive analysis</p>
      </footer>
    </article>
  );
}

function RiskSeverityDistributionCard() {
  return (
    <article className="dashInsight dashInsight--severity">
      <header className="dashInsight__head">
        <h3 className="dashInsight__title">
          <AlertTriangle
            size={16}
            strokeWidth={2}
            className="dashInsight__titleIcon dashInsight__titleIcon--amber"
            aria-hidden
          />
          Risk severity distribution
        </h3>
        <p className="dashInsight__confidence">
          Confidence:{" "}
          <span className="dashInsight__confidenceValue">
            {ANALYSIS_CONFIDENCE_PCT}%
          </span>
        </p>
      </header>

      <div className="dashInsight__body dashInsight__body--severity">
        <div className="dashDonut" aria-hidden>
          <div className="dashDonut__hole" />
        </div>

        <div className="dashSeverityLegend">
          <ul className="dashSeverityLegend__list">
            {SEVERITY_ROWS.map((row) => (
              <li key={row.key} className="dashSeverityLegend__row">
                <span className="dashSeverityLegend__label">
                  <span
                    className="dashSeverityLegend__dot"
                    style={{ background: row.color }}
                  />
                  {row.label}
                </span>
                <span className="dashSeverityLegend__pct">{row.pct}</span>
                <span className="dashSeverityLegend__count">{row.count}</span>
                <span
                  className={
                    row.trend === "up"
                      ? "dashSeverityLegend__trend dashSeverityLegend__trend--up"
                      : "dashSeverityLegend__trend dashSeverityLegend__trend--down"
                  }
                >
                  {row.delta}{" "}
                  <span className="dashSeverityLegend__trendPct">
                    {row.deltaPct}
                  </span>
                </span>
              </li>
            ))}
          </ul>
          <div className="dashSeverityLegend__divider" />
          <div className="dashSeverityLegend__row dashSeverityLegend__row--total">
            <span className="dashSeverityLegend__label">Total</span>
            <span className="dashSeverityLegend__pct">100%</span>
            <span className="dashSeverityLegend__count">4,716</span>
            <span className="dashSeverityLegend__trend dashSeverityLegend__trend--up">
              +189{" "}
              <span className="dashSeverityLegend__trendPct">(4.2%)</span>
            </span>
          </div>
        </div>
      </div>

      <footer className="dashInsight__foot">
        <Info size={14} strokeWidth={2} className="dashInsight__footIcon" aria-hidden />
        <p>
          Severity is determined by AI analysis of impact scale, financial
          implications, regulatory factors, affected entities, and urgency
          indicators.
        </p>
      </footer>
    </article>
  );
}

function AnalysisConfidenceCard() {
  const r = 52;
  const c = 2 * Math.PI * r;
  const dash = (ANALYSIS_CONFIDENCE_PCT / 100) * c;

  return (
    <article className="dashInsight dashInsight--confidence">
      <header className="dashInsight__head dashInsight__head--single">
        <h3 className="dashInsight__title">
          <LineChart
            size={16}
            strokeWidth={2}
            className="dashInsight__titleIcon dashInsight__titleIcon--cyan"
            aria-hidden
          />
          Analysis confidence
        </h3>
      </header>

      <div className="dashInsight__body dashInsight__body--confidence">
        <div className="dashConfRing">
          <svg
            className="dashConfRing__svg"
            viewBox="0 0 120 120"
            aria-label={`Average confidence ${ANALYSIS_CONFIDENCE_PCT} percent`}
          >
            <circle
              className="dashConfRing__track"
              cx="60"
              cy="60"
              r={r}
              fill="none"
              strokeWidth="10"
            />
            <circle
              className="dashConfRing__progress"
              cx="60"
              cy="60"
              r={r}
              fill="none"
              strokeWidth="10"
              strokeLinecap="round"
              strokeDasharray={`${dash} ${c}`}
              transform="rotate(-90 60 60)"
            />
          </svg>
          <div className="dashConfRing__label">
            <span className="dashConfRing__value">{ANALYSIS_CONFIDENCE_PCT}%</span>
            <span className="dashConfRing__hint">
              Average confidence in risk classification
            </span>
          </div>
        </div>

        <div className="dashConfBreakdown">
          <div className="dashSeverityLegend__divider" />
          <ul className="dashConfBreakdown__list">
            {CONFIDENCE_BREAKDOWN.map((row) => (
              <li key={row.key} className="dashConfBreakdown__row">
                <span className="dashConfBreakdown__label">{row.label}</span>
                <span
                  className={`dashConfBreakdown__count dashConfBreakdown__count--${row.tone}`}
                >
                  {row.count}
                </span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </article>
  );
}

function RiskTaxonomyPanel() {
  const [selectedKey, setSelectedKey] = useState<string | null>(null);

  const totalRisks = useMemo(
    () => TAXONOMY_DOMAINS.reduce((sum, d) => sum + d.count, 0),
    [],
  );

  const rows = useMemo(
    () =>
      TAXONOMY_DOMAINS.map((d) => {
        const pct = totalRisks > 0 ? (d.count / totalRisks) * 100 : 0;
        return { ...d, pct };
      }),
    [totalRisks],
  );

  return (
    <article className="dashTaxonomy" aria-labelledby="dash-taxonomy-title">
      <header className="dashTaxonomy__header">
        <h3 id="dash-taxonomy-title" className="dashTaxonomy__title">
          <Network
            size={17}
            strokeWidth={2}
            className="dashTaxonomy__titleIcon"
            aria-hidden
          />
          Risk database taxonomy (7 domains)
        </h3>
        <p className="dashTaxonomy__total">
          Total:{" "}
          <strong className="dashTaxonomy__totalValue">{totalRisks}</strong>{" "}
          risks
        </p>
      </header>

      <ul className="dashTaxonomy__list" role="list">
        {rows.map((d) => {
          const isActive = selectedKey === d.key;
          return (
            <li key={d.key} className="dashTaxonomy__item">
              <button
                type="button"
                className={`dashTaxonomy__row${isActive ? " dashTaxonomy__row--active" : ""}`}
                aria-pressed={isActive}
                onClick={() => {
                  const next = selectedKey === d.key ? null : d.key;
                  setSelectedKey(next);
                  if (next !== null) {
                    toast.info(`Filtering by: ${d.label}`, {
                      autoClose: 2200,
                    });
                  }
                }}
              >
                <span
                  className="dashTaxonomy__dot"
                  style={{ background: d.color }}
                  aria-hidden
                />
                <span className="dashTaxonomy__name">
                  {d.order}. {d.label}
                </span>
                <span className="dashTaxonomy__barTrack" aria-hidden>
                  <span
                    className="dashTaxonomy__barFill"
                    style={{
                      width: `${Math.min(100, d.pct)}%`,
                      background: d.color,
                    }}
                  />
                </span>
                <span className="dashTaxonomy__pct">{d.pct.toFixed(1)}%</span>
                <span className="dashTaxonomy__count">{d.count}</span>
              </button>
            </li>
          );
        })}
      </ul>

      <footer className="dashTaxonomy__foot">
        Click any domain to filter and view associated risks
      </footer>
    </article>
  );
}

type RiskCategoryRow = {
  key: string;
  label: string;
  dotColor: string;
  subcategoryCount: number;
  pct: number;
  count: number;
  subcategories: { key: string; label: string }[];
};

const TOP_RISK_CATEGORIES: RiskCategoryRow[] = [
  {
    key: "technical",
    label: "Technical",
    dotColor: "#22d3ee",
    subcategoryCount: 4,
    pct: 0,
    count: 0,
    subcategories: [
      { key: "t1", label: "System reliability" },
      { key: "t2", label: "Data integrity" },
      { key: "t3", label: "Model robustness" },
      { key: "t4", label: "Infrastructure" },
    ],
  },
  {
    key: "operational",
    label: "Operational",
    dotColor: "#f97316",
    subcategoryCount: 4,
    pct: 0,
    count: 0,
    subcategories: [
      { key: "o1", label: "Process controls" },
      { key: "o2", label: "Human oversight" },
      { key: "o3", label: "Incident response" },
      { key: "o4", label: "Supply chain" },
    ],
  },
  {
    key: "business",
    label: "Business",
    dotColor: "#a855f7",
    subcategoryCount: 4,
    pct: 0,
    count: 0,
    subcategories: [
      { key: "b1", label: "Financial exposure" },
      { key: "b2", label: "Reputation" },
      { key: "b3", label: "Compliance" },
      { key: "b4", label: "Strategic alignment" },
    ],
  },
];

function TopRiskCategoriesPanel() {
  const [openKeys, setOpenKeys] = useState<Set<string>>(() => new Set());

  const toggle = (key: string) => {
    setOpenKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  return (
    <article className="dashRiskCat" aria-labelledby="dash-risk-cat-title">
      <header className="dashRiskCat__header">
        <h3 id="dash-risk-cat-title" className="dashRiskCat__title">
          <Layers
            size={17}
            strokeWidth={2}
            className="dashRiskCat__titleIcon"
            aria-hidden
          />
          Top risk categories
        </h3>
        <p className="dashRiskCat__sortHint">Sorted High → Low</p>
      </header>

      <ul className="dashRiskCat__list" role="list">
        {TOP_RISK_CATEGORIES.map((cat) => {
          const isOpen = openKeys.has(cat.key);
          return (
            <li key={cat.key} className="dashRiskCat__item">
              <button
                type="button"
                className={`dashRiskCat__row${isOpen ? " dashRiskCat__row--open" : ""}`}
                aria-expanded={isOpen}
                onClick={() => toggle(cat.key)}
              >
                <span className="dashRiskCat__rowMain">
                  <ChevronRight
                    size={18}
                    strokeWidth={2}
                    className="dashRiskCat__chevron"
                    aria-hidden
                  />
                  <span
                    className="dashRiskCat__dot"
                    style={{ background: cat.dotColor }}
                    aria-hidden
                  />
                  <span className="dashRiskCat__textBlock">
                    <span className="dashRiskCat__name">{cat.label}</span>
                    <span className="dashRiskCat__subMeta">
                      {cat.subcategoryCount} subcategories
                    </span>
                  </span>
                </span>
                <span className="dashRiskCat__stats">
                  <span className="dashRiskCat__pct">{cat.pct}%</span>
                  <span className="dashRiskCat__countWrap">
                    <Link2 size={14} strokeWidth={2} className="dashRiskCat__linkIcon" aria-hidden />
                    <span className="dashRiskCat__count">{cat.count}</span>
                  </span>
                </span>
              </button>
              <div className="dashRiskCat__barRow" aria-hidden>
                <div className="dashRiskCat__barTrack">
                  <div
                    className="dashRiskCat__barFill"
                    style={{
                      width: `${Math.min(100, cat.pct)}%`,
                      background: cat.dotColor,
                    }}
                  />
                </div>
              </div>
              {isOpen ? (
                <ul className="dashRiskCat__subList" role="list">
                  {cat.subcategories.map((sub) => (
                    <li key={sub.key} className="dashRiskCat__subItem">
                      <button
                        type="button"
                        className="dashRiskCat__subBtn"
                        onClick={(e) => {
                          e.stopPropagation();
                          toast.info(`Filter: ${cat.label} → ${sub.label}`, {
                            autoClose: 2200,
                          });
                        }}
                      >
                        <span
                          className="dashRiskCat__subDot"
                          style={{ background: cat.dotColor }}
                          aria-hidden
                        />
                        {sub.label}
                      </button>
                    </li>
                  ))}
                </ul>
              ) : null}
            </li>
          );
        })}
      </ul>

      <footer className="dashRiskCat__foot">
        Click to expand/collapse categories. Click subcategories to filter.
      </footer>
    </article>
  );
}

export function DashboardPage() {
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    setDocumentPageTitle("Dashboard");
  }, []);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    window.setTimeout(() => {
      setRefreshing(false);
      toast.success("Dashboard metrics refreshed.", { autoClose: 2200 });
    }, 650);
  }, []);

  return (
    <main className="mainLayout__content dashboardPage">
      <PageHeader
        title="Dashboard"
        subtitle="AI Risk Intelligence Platform Overview"
        actions={
          <button
            type="button"
            className="usersPage__inviteBtn"
            onClick={handleRefresh}
            disabled={refreshing}
            aria-busy={refreshing}
          >
            <RefreshCw
              size={18}
              strokeWidth={2}
              className={refreshing ? "pageHeader__refreshIcon--spin" : ""}
              aria-hidden
            />
            Refresh
          </button>
        }
      />

      <section className="dashboardPage__section" aria-labelledby="dash-metrics-heading">
        <h2 id="dash-metrics-heading" className="dashboardPage__sectionTitle">
          <Target
            size={16}
            strokeWidth={2}
            className="dashboardPage__sectionIcon"
            aria-hidden
          />
          Platform metrics
        </h2>

        <div className="dashboardPage__grid">
          {METRICS.map((m) => {
            const stroke = ACCENT_COLORS[m.accent];
            const Icon = m.Icon;
            return (
              <article
                key={m.key}
                className={`dashCard dashCard--${m.accent}`}
              >
                <div className="dashCard__top">
                  <span className="dashCard__label">{m.title}</span>
                  <span className="dashCard__iconWrap" aria-hidden>
                    <Icon size={18} strokeWidth={2} />
                  </span>
                </div>
                <div className="dashCard__mid">
                  <span className="dashCard__value">{m.value}</span>
                  <div className="dashCard__sparkWrap">
                    <MetricSparkline color={stroke} points={m.sparkPoints} />
                  </div>
                </div>
                <div
                  className={`dashCard__change dashCard__change--${m.trend}`}
                >
                  {m.trend === "up" ? (
                    <TrendingUp size={14} strokeWidth={2} aria-hidden />
                  ) : m.trend === "down" ? (
                    <TrendingDown size={14} strokeWidth={2} aria-hidden />
                  ) : (
                    <span className="dashCard__changeDash" aria-hidden>
                      —
                    </span>
                  )}
                  <span>
                    {m.changePct} · {m.changeAbs}
                  </span>
                </div>
                <p className="dashCard__footer">{m.footer}</p>
              </article>
            );
          })}
        </div>
      </section>

      <section
        className="dashboardPage__section dashboardPage__section--insights"
        aria-labelledby="dash-insights-heading"
      >
        <h2 id="dash-insights-heading" className="dashboardPage__sectionTitle">
          <Shield
            size={16}
            strokeWidth={2}
            className="dashboardPage__sectionIcon"
            aria-hidden
          />
          Risk analysis
        </h2>
        <div className="dashboardPage__insightsRow">
          <RiskSeverityDistributionCard />
          <AnalysisConfidenceCard />
        </div>
      </section>

      <section
        className="dashboardPage__section dashboardPage__section--taxonomy"
        aria-label="Risk database taxonomy"
      >
        <RiskTaxonomyPanel />
      </section>

      <section
        className="dashboardPage__section dashboardPage__section--riskCat"
        aria-label="Top risk categories"
      >
        <TopRiskCategoriesPanel />
      </section>

      <section
        className="dashboardPage__section dashboardPage__section--sector"
        aria-label="Sector and industry breakdown"
      >
        <SectorIndustryPanel />
      </section>

      <section
        className="dashboardPage__section dashboardPage__section--weeklyHeatmap"
        aria-label="Weekly risk activity heatmap"
      >
        <WeeklyRiskActivityHeatmap />
      </section>
    </main>
  );
}
