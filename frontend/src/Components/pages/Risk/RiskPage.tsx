import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "react-toastify";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  Download,
  Eye,
  RefreshCw,
  RotateCcw,
  Search,
  Shield,
} from "lucide-react";
import { setDocumentPageTitle } from "../../../utils/pageTitle";
import { usePagination } from "../../../utils/usePagination";
import { PageHeading } from "../../Layout/PageHeading";
import { DataTablePagination } from "../../common/DataTablePagination";
import "../Users/usersPage.css";
import "./riskPage.css";

type RiskMetric = {
  key: string;
  label: string;
  value: string;
  Icon: LucideIcon;
  variant: "total" | "technical" | "operational" | "business";
};

const RISK_METRICS: RiskMetric[] = [
  {
    key: "total",
    label: "TOTAL RISKS",
    value: "0",
    Icon: Shield,
    variant: "total",
  },
  {
    key: "technical",
    label: "TECHNICAL RISKS",
    value: "0",
    Icon: AlertTriangle,
    variant: "technical",
  },
  {
    key: "operational",
    label: "OPERATIONAL RISKS",
    value: "0",
    Icon: AlertTriangle,
    variant: "operational",
  },
  {
    key: "business",
    label: "BUSINESS RISKS",
    value: "0",
    Icon: Eye,
    variant: "business",
  },
];

type RiskRow = {
  id: string;
  title: string;
  domain: string;
  primaryRisk: string;
  secondaryRisk: string;
  sector: string;
  industry: string;
  intent: string;
  qualityScore: string;
  /** For filter demo */
  primaryKey: string;
  tagKey: string;
};

const MOCK_RISK_ROWS: RiskRow[] = [
  {
    id: "R-10042",
    title: "Bias in recruitment screening model",
    domain: "Discrimination & Toxicity",
    primaryRisk: "Technical",
    secondaryRisk: "Fairness",
    sector: "Private",
    industry: "HR Technology",
    intent: "Commercial",
    qualityScore: "0.87",
    primaryKey: "technical",
    tagKey: "bias",
  },
];

function riskMatchesFilters(
  row: RiskRow,
  primaryRisk: string,
  tag: string,
  search: string,
): boolean {
  if (primaryRisk !== "all" && row.primaryKey !== primaryRisk) {
    return false;
  }
  if (tag !== "all" && row.tagKey !== tag) {
    return false;
  }
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.id,
    row.title,
    row.domain,
    row.primaryRisk,
    row.secondaryRisk,
    row.sector,
    row.industry,
    row.intent,
    row.qualityScore,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function RiskPage() {
  const baseId = useId();
  const [primaryRisk, setPrimaryRisk] = useState("all");
  const [tag, setTag] = useState("all");
  const [order, setOrder] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [riskPageSize, setRiskPageSize] = useState(10);
  const [refreshing, setRefreshing] = useState(false);

  const filteredRows = useMemo(
    () =>
      MOCK_RISK_ROWS.filter((row) =>
        riskMatchesFilters(row, primaryRisk, tag, searchQuery),
      ),
    [primaryRisk, tag, searchQuery],
  );

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    if (order === "oldest") {
      copy.sort((a, b) => a.id.localeCompare(b.id));
    } else if (order === "score") {
      copy.sort(
        (a, b) =>
          Number.parseFloat(b.qualityScore) -
          Number.parseFloat(a.qualityScore),
      );
    } else {
      copy.sort((a, b) => b.id.localeCompare(a.id));
    }
    return copy;
  }, [filteredRows, order]);

  const pager = usePagination({
    items: sortedRows,
    pageSize: riskPageSize,
    resetKey: `${primaryRisk}|${tag}|${order}|${searchQuery}`,
  });

  useEffect(() => {
    setDocumentPageTitle("Risks");
  }, []);

  const filterId = (name: string) => `${baseId}-${name}`;

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    window.setTimeout(() => {
      setRefreshing(false);
      toast.success("Risk list refreshed.", { autoClose: 2000 });
    }, 650);
  }, []);

  const handleExport = useCallback(() => {
    toast.info("Export is not connected to the API yet.", {
      autoClose: 3000,
    });
  }, []);

  const clearFilters = useCallback(() => {
    setPrimaryRisk("all");
    setTag("all");
    setOrder("newest");
    setSearchQuery("");
  }, []);

  return (
    <main className="mainLayout__content riskPage">
      <header className="riskPage__header">
        <div className="riskPage__headerText">
          <PageHeading className="riskPage__title">Risks</PageHeading>
          <p className="riskPage__subtitle">
            AI risk extractions and analysis
          </p>
        </div>
        <div className="riskPage__headerActions">
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
              className={refreshing ? "riskPage__btnIcon--spin" : undefined}
              aria-hidden
            />
            Refresh
          </button>
          <button
            type="button"
            className="usersPage__inviteBtn"
            onClick={handleExport}
          >
            <Download size={18} strokeWidth={2} aria-hidden />
            Export
          </button>
        </div>
      </header>

      <div className="riskPage__grid">
        {RISK_METRICS.map((m) => (
          <article
            key={m.key}
            className={`riskPage__card riskPage__card--${m.variant}`}
          >
            <div className={`riskPage__cardIcon riskPage__cardIcon--${m.variant}`}>
              <m.Icon size={22} strokeWidth={2} aria-hidden />
            </div>
            <div className="riskPage__cardBody">
              <p className="riskPage__cardLabel">{m.label}</p>
              <p className="riskPage__cardValue">{m.value}</p>
            </div>
          </article>
        ))}
      </div>

      <section className="riskPage__filters" aria-label="Filter risks">
        <div className="riskPage__filter">
          <label htmlFor={filterId("primary")}>PRIMARY RISK</label>
          <select
            id={filterId("primary")}
            value={primaryRisk}
            onChange={(e) => setPrimaryRisk(e.target.value)}
          >
            <option value="all">All</option>
            <option value="technical">Technical</option>
            <option value="operational">Operational</option>
            <option value="business">Business</option>
          </select>
        </div>
        <div className="riskPage__filter">
          <label htmlFor={filterId("tag")}>TAG</label>
          <select
            id={filterId("tag")}
            value={tag}
            onChange={(e) => setTag(e.target.value)}
          >
            <option value="all">All</option>
            <option value="bias">Bias</option>
            <option value="privacy">Privacy</option>
            <option value="safety">Safety</option>
            <option value="misinformation">Misinformation</option>
          </select>
        </div>
        <div className="riskPage__filter">
          <label htmlFor={filterId("order")}>ORDER</label>
          <select
            id={filterId("order")}
            value={order}
            onChange={(e) => setOrder(e.target.value)}
          >
            <option value="newest">Newest</option>
            <option value="oldest">Oldest</option>
            <option value="score">Highest score</option>
          </select>
        </div>
        <button type="button" className="riskPage__clearBtn" onClick={clearFilters}>
          <RotateCcw size={16} strokeWidth={2} aria-hidden />
          Clear Filters
        </button>
        <div className="riskPage__searchWrap">
          <Search
            className="riskPage__searchIcon"
            size={18}
            strokeWidth={2}
            aria-hidden
          />
          <input
            id={filterId("search")}
            type="search"
            className="riskPage__searchInput"
            placeholder="Search ID, title, domain, sector…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Search risks"
          />
        </div>
      </section>

      <section className="riskPage__tableSection" aria-label="Risk records">
        <div className="riskPage__tableWrap">
          <div className="riskPage__tableScroll">
            <table className="riskPage__table">
              <thead>
                <tr>
                  <th scope="col" className="riskPage__th riskPage__th--left">
                    RISK ID
                  </th>
                  <th scope="col" className="riskPage__th riskPage__th--left">
                    TITLE
                  </th>
                  <th scope="col" className="riskPage__th riskPage__th--left">
                    DOMAIN
                  </th>
                  <th scope="col" className="riskPage__th riskPage__th--left">
                    PRIMARY RISK
                  </th>
                  <th scope="col" className="riskPage__th riskPage__th--left">
                    SECONDARY RISK
                  </th>
                  <th scope="col" className="riskPage__th riskPage__th--left">
                    SECTOR
                  </th>
                  <th scope="col" className="riskPage__th riskPage__th--left">
                    INDUSTRY
                  </th>
                  <th scope="col" className="riskPage__th riskPage__th--left">
                    INTENT
                  </th>
                  <th scope="col" className="riskPage__th riskPage__th--right">
                    QUALITY SCORE
                  </th>
                </tr>
              </thead>
              <tbody>
                {pager.pageItems.length === 0 ? (
                  <tr>
                    <td className="riskPage__td riskPage__emptyCell" colSpan={9}>
                      No risks match your filters or search.
                    </td>
                  </tr>
                ) : (
                  pager.pageItems.map((row) => (
                    <tr key={row.id}>
                      <td className="riskPage__td">
                        <span className="riskPage__id">{row.id}</span>
                      </td>
                      <td className="riskPage__td riskPage__td--title">{row.title}</td>
                      <td className="riskPage__td riskPage__td--muted">{row.domain}</td>
                      <td className="riskPage__td">{row.primaryRisk}</td>
                      <td className="riskPage__td riskPage__td--muted">
                        {row.secondaryRisk}
                      </td>
                      <td className="riskPage__td riskPage__td--muted">{row.sector}</td>
                      <td className="riskPage__td riskPage__td--muted">{row.industry}</td>
                      <td className="riskPage__td riskPage__td--muted">{row.intent}</td>
                      <td className="riskPage__td riskPage__td--right riskPage__td--score">
                        {row.qualityScore}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
          <DataTablePagination
            className="riskPage__pager"
            page={pager.page}
            pageCount={pager.pageCount}
            total={pager.total}
            pageSize={pager.pageSize}
            from={pager.from}
            to={pager.to}
            onPageChange={pager.setPage}
            onPageSizeChange={setRiskPageSize}
          />
        </div>
      </section>
    </main>
  );
}
