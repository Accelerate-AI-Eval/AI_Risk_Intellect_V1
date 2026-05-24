import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import type { LucideIcon } from "lucide-react";
import {
  AlertTriangle,
  ChartLine,
  Download,
  Eye,
  FilterX,
  RefreshCw,
  Search,
  Shield,
} from "lucide-react";
import { setDocumentPageTitle } from "../../../utils/pageTitle";
import { usePagination } from "../../../utils/usePagination";
import { PageHeader } from "../../Layout/PageHeader";
import { DataTablePagination } from "../../common/DataTablePagination";
import "../Users/usersPage.css";
import { authFetch } from "../../../utils/authFetch";
import { formatDisplayDate } from "../../../utils/formatDate";
import {
  formatRiskDomain,
  formatRiskId,
  normalizeRisksFromApi,
  type RiskDetail,
  type RiskListMetrics,
} from "./riskData";
import "./riskPage.css";

type RiskMetric = {
  key: string;
  label: string;
  value: string;
  Icon: LucideIcon;
  variant: "total" | "technical" | "operational" | "business";
};

function buildRiskMetrics(m: RiskListMetrics): RiskMetric[] {
  return [
    {
      key: "total",
      label: "TOTAL RISKS",
      value: String(m.total),
      Icon: Shield,
      variant: "total",
    },
    {
      key: "technical",
      label: "TECHNICAL RISKS",
      value: String(m.technical),
      Icon: AlertTriangle,
      variant: "technical",
    },
    {
      key: "operational",
      label: "OPERATIONAL RISKS",
      value: String(m.operational),
      Icon: AlertTriangle,
      variant: "operational",
    },
    {
      key: "business",
      label: "BUSINESS RISKS",
      value: String(m.business),
      Icon: Eye,
      variant: "business",
    },
  ];
}

type RiskRow = RiskDetail;

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
    row.displayId ?? "",
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
  const navigate = useNavigate();
  const baseId = useId();
  const [primaryRisk, setPrimaryRisk] = useState("all");
  const [tag, setTag] = useState("all");
  const [order, setOrder] = useState("newest");
  const [searchQuery, setSearchQuery] = useState("");
  const [riskPageSize, setRiskPageSize] = useState(10);
  const [refreshing, setRefreshing] = useState(false);
  const [rows, setRows] = useState<RiskRow[]>([]);
  const [metrics, setMetrics] = useState<RiskListMetrics>({
    total: 0,
    technical: 0,
    operational: 0,
    business: 0,
  });
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">(
    "idle",
  );

  const loadRisks = useCallback(async () => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      setRows([]);
      setLoadState("idle");
      return;
    }

    setLoadState("loading");
    try {
      const res = await authFetch("/risks");
      if (!res.ok) {
        setLoadState("error");
        return;
      }
      const data = normalizeRisksFromApi(await res.json());
      setRows(
        data.risks.map((r) => {
          const createdAt = r.createdAt ?? r.ingestedAt;
          return {
            ...r,
            createdAt,
            ingestedAt: createdAt ? formatDisplayDate(createdAt) : "—",
          };
        }),
      );
      setMetrics(data.metrics);
      setLoadState("idle");
    } catch {
      setLoadState("error");
    }
  }, []);

  useEffect(() => {
    void loadRisks();
  }, [loadRisks]);

  const displayMetrics = useMemo(() => buildRiskMetrics(metrics), [metrics]);

  const filteredRows = useMemo(
    () =>
      rows.filter((row) =>
        riskMatchesFilters(row, primaryRisk, tag, searchQuery),
      ),
    [rows, primaryRisk, tag, searchQuery],
  );

  const sortedRows = useMemo(() => {
    const copy = [...filteredRows];
    const createdAtMs = (row: RiskRow) => {
      const t = new Date(row.createdAt ?? row.ingestedAt).getTime();
      return Number.isNaN(t) ? 0 : t;
    };
    if (order === "oldest") {
      copy.sort((a, b) => createdAtMs(a) - createdAtMs(b));
    } else if (order === "score") {
      copy.sort(
        (a, b) =>
          Number.parseFloat(b.qualityScore) -
          Number.parseFloat(a.qualityScore),
      );
    } else {
      copy.sort((a, b) => createdAtMs(b) - createdAtMs(a));
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

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadRisks();
    setRefreshing(false);
    toast.success("Risk list refreshed.", { autoClose: 2000 });
  }, [loadRisks]);

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
      <PageHeader
        title="Risks"
        subtitle="AI risk extractions and analysis"
        actions={
          <>
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
                className={refreshing ? "pageHeader__refreshIcon--spin" : undefined}
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
          </>
        }
      />

      <div className="riskPage__grid">
        {displayMetrics.map((m) => (
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
        <button
          type="button"
          className="riskPage__clearBtn"
          onClick={clearFilters}
          aria-label="Clear Filter"
          data-tooltip="Clear Filter"
        >
          <FilterX size={18} strokeWidth={2} aria-hidden />
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
                  <th
                    scope="col"
                    className="riskPage__th riskPage__th--left riskPage__th--sticky riskPage__th--stickyId"
                  >
                    RISK ID
                  </th>
                  <th
                    scope="col"
                    className="riskPage__th riskPage__th--left riskPage__th--sticky riskPage__th--stickyTitle"
                  >
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
                  <th scope="col" className="riskPage__th riskPage__th--center">
                    ACTIONS
                  </th>
                </tr>
              </thead>
              <tbody>
                {loadState === "loading" ? (
                  <tr>
                    <td className="riskPage__td riskPage__emptyCell" colSpan={10}>
                      Loading risks…
                    </td>
                  </tr>
                ) : pager.pageItems.length === 0 ? (
                  <tr>
                    <td className="riskPage__td riskPage__emptyCell" colSpan={10}>
                      {searchQuery.trim()
                        ? "No risks match your filters or search."
                        : loadState === "error"
                          ? "Could not load risks."
                          : "No risks yet. Enqueue a URL and wait for a DONE job."}
                    </td>
                  </tr>
                ) : (
                  pager.pageItems.map((row) => (
                    <tr key={row.id}>
                      <td className="riskPage__td riskPage__td--sticky riskPage__td--stickyId">
                        <span className="riskPage__rowKey">{formatRiskId(row)}</span>
                      </td>
                      <td className="riskPage__td riskPage__td--title riskPage__td--sticky riskPage__td--stickyTitle">
                        {row.title}
                      </td>
                      <td className="riskPage__td riskPage__td--muted riskPage__td--domain">
                        <span className="riskPage__domain">{formatRiskDomain(row.domain)}</span>
                      </td>
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
                      <td className="riskPage__td riskPage__td--center riskPage__td--actions">
                        <div className="riskPage__actions">
                          <button
                            type="button"
                            className="riskPage__actionBtn riskPage__actionBtn--analysis"
                            aria-label={`View analysis for ${formatRiskId(row)}`}
                            data-tooltip="Analysis"
                            onClick={() =>
                              navigate(
                                `/risk/${encodeURIComponent(row.id)}?tab=overview`,
                              )
                            }
                          >
                            <ChartLine size={16} strokeWidth={2} aria-hidden />
                          </button>
                        </div>
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
