import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "react-toastify";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CheckCircle2,
  Clock,
  ListChecks,
  RefreshCw,
  Search,
  SkipForward,
  Timer,
  Upload,
  XCircle,
  Zap,
} from "lucide-react";
import { setDocumentPageTitle } from "../../../utils/pageTitle";
import { usePagination } from "../../../utils/usePagination";
import { PageHeading } from "../../Layout/PageHeading";
import { DataTablePagination } from "../../common/DataTablePagination";
import "../Users/usersPage.css";
import "./jobsPage.css";

type JobTab = "regular" | "aiid";

type MetricAccent = "blue" | "green" | "amber" | "red" | "slate";

type Metric = {
  key: string;
  label: string;
  value: string;
  accent: MetricAccent;
  Icon: LucideIcon;
};

const REGULAR_METRICS: Metric[] = [
  { key: "total", label: "TOTAL JOBS", value: "128", accent: "blue", Icon: ListChecks },
  { key: "success", label: "SUCCESS RATE", value: "0%", accent: "green", Icon: CheckCircle2 },
  { key: "pending", label: "PENDING QUEUE", value: "0", accent: "amber", Icon: Clock },
  { key: "failed", label: "FAILED JOBS", value: "0", accent: "red", Icon: XCircle },
  { key: "running", label: "RUNNING NOW", value: "0", accent: "slate", Icon: Zap },
  { key: "completed24h", label: "24H COMPLETED", value: "0", accent: "slate", Icon: Activity },
  { key: "avgProc", label: "AVG PROCESSING", value: "0s", accent: "slate", Icon: Timer },
  { key: "skipped", label: "SKIPPED", value: "128", accent: "slate", Icon: SkipForward },
];

/** AIID tab: labels and zeroed demo values; accents match AIID dashboard spec */
const AIID_METRICS: Metric[] = [
  { key: "total", label: "TOTAL AIID JOBS", value: "0", accent: "blue", Icon: ListChecks },
  { key: "success", label: "SUCCESS RATE", value: "0%", accent: "green", Icon: CheckCircle2 },
  { key: "pending", label: "PENDING QUEUE", value: "0", accent: "amber", Icon: Clock },
  { key: "failed", label: "FAILED JOBS", value: "0", accent: "red", Icon: XCircle },
  { key: "running", label: "RUNNING NOW", value: "0", accent: "blue", Icon: Zap },
  { key: "completed24h", label: "24H COMPLETED", value: "0", accent: "blue", Icon: Activity },
  { key: "avgProc", label: "AVG PROCESSING", value: "0s", accent: "slate", Icon: Timer },
  { key: "skipped", label: "SKIPPED", value: "0", accent: "slate", Icon: SkipForward },
];

type JobRow = {
  id: string;
  url: string;
  status: string;
  jobType: string;
  source: string;
  tries: string;
  created: string;
};

/** Placeholder row until jobs API is wired. */
const MOCK_JOB_ROWS: JobRow[] = [
  {
    id: "201",
    url: "https://example.com/job-item/1",
    status: "SKIPPED",
    jobType: "INGEST",
    source: "Manual",
    tries: "1",
    created: "2 days ago",
  },
];

function jobMatchesFilters(
  row: JobRow,
  status: string,
  type: string,
  source: string,
  search: string,
): boolean {
  if (status !== "all" && row.status.toLowerCase() !== status) {
    return false;
  }
  if (source !== "all" && row.source.toLowerCase() !== source) {
    return false;
  }
  if (type !== "all" && row.jobType.toLowerCase() !== type) {
    return false;
  }
  const q = search.trim().toLowerCase();
  if (!q) return true;
  const hay = [
    row.id,
    row.url,
    row.status,
    row.jobType,
    row.source,
    row.tries,
    row.created,
  ]
    .join(" ")
    .toLowerCase();
  return hay.includes(q);
}

export function JobsPage() {
  const baseId = useId();
  const [tab, setTab] = useState<JobTab>("regular");
  const [status, setStatus] = useState("all");
  const [type, setType] = useState("all");
  const [source, setSource] = useState("all");
  const [importType, setImportType] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [jobPageSize, setJobPageSize] = useState(10);
  const [refreshing, setRefreshing] = useState(false);
  const [metricsKey, setMetricsKey] = useState(0);

  const metrics = tab === "regular" ? REGULAR_METRICS : AIID_METRICS;

  const filteredJobRows = useMemo(() => {
    if (tab !== "regular") return [];
    return MOCK_JOB_ROWS.filter((row) =>
      jobMatchesFilters(row, status, type, source, searchQuery),
    );
  }, [tab, status, type, source, searchQuery]);

  const jobPager = usePagination({
    items: tab === "regular" ? filteredJobRows : [],
    pageSize: jobPageSize,
    resetKey: `${tab}|${status}|${type}|${source}|${searchQuery}`,
  });

  useEffect(() => {
    setDocumentPageTitle(tab === "aiid" ? "AIID Jobs" : "Jobs");
  }, [tab]);

  const handleRefresh = useCallback(() => {
    setRefreshing(true);
    window.setTimeout(() => {
      setMetricsKey((k) => k + 1);
      setRefreshing(false);
      toast.success("Job stats refreshed.", { autoClose: 2000 });
    }, 650);
  }, []);

  const clearFilters = () => {
    setStatus("all");
    setType("all");
    setSource("all");
    setSearchQuery("");
  };

  const resetAiidImport = () => {
    setImportType("");
  };

  const filterId = (name: string) => `${baseId}-${name}`;

  return (
    <main className="mainLayout__content jobsPage">
      <header className="jobsPage__header">
        <div className="jobsPage__headerText">
          <PageHeading className="jobsPage__title">Jobs</PageHeading>
          <p className="jobsPage__subtitle">Monitor and manage crawler jobs</p>
        </div>
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
            className={refreshing ? "jobsPage__refreshIcon--spin" : undefined}
            aria-hidden
          />
          Refresh
        </button>
      </header>

      <div className="usersPage__tabs" role="tablist" aria-label="Job type">
        <button
          type="button"
          role="tab"
          aria-selected={tab === "regular"}
          className={`usersPage__tab${tab === "regular" ? " usersPage__tab--selected" : ""}`}
          onClick={() => setTab("regular")}
        >
          Regular Jobs
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={tab === "aiid"}
          className={`usersPage__tab${tab === "aiid" ? " usersPage__tab--selected" : ""}`}
          onClick={() => setTab("aiid")}
        >
          AIID Jobs
        </button>
      </div>

      <div className="jobsPage__grid" key={`${tab}-${metricsKey}`}>
        {metrics.map((m) => (
          <article key={m.key} className="jobsPage__card">
            <div className={`jobsPage__cardIcon jobsPage__cardIcon--${m.accent}`}>
              <m.Icon size={22} strokeWidth={2} aria-hidden />
            </div>
            <div className="jobsPage__cardBody">
              <p className="jobsPage__cardLabel">{m.label}</p>
              <p className="jobsPage__cardValue">{m.value}</p>
            </div>
          </article>
        ))}
      </div>

      {tab === "aiid" ? (
        <section className="jobsPage__import" aria-labelledby={`${baseId}-import-title`}>
          <h2 id={`${baseId}-import-title`} className="jobsPage__importTitle">
            + Import AIID Jobs
          </h2>
          <div className="jobsPage__importRow">
            <div className="jobsPage__importField">
              <label htmlFor={filterId("import-type")}>Import Type</label>
              <select
                id={filterId("import-type")}
                value={importType}
                onChange={(e) => setImportType(e.target.value)}
              >
                <option value="">Select Import type…</option>
                <option value="bulk">Bulk URL file</option>
                <option value="feed">Feed / sitemap</option>
                <option value="manual">Manual list</option>
              </select>
            </div>
            <div className="jobsPage__importActions">
              <button
                type="button"
                className="jobsPage__btnImport"
                onClick={() => {
                  if (!importType) {
                    toast.error("Select an import type.", { autoClose: 2500 });
                    return;
                  }
                  toast.info("AIID import is not connected to the API yet.", {
                    autoClose: 3500,
                  });
                }}
              >
                <Upload size={18} strokeWidth={2} aria-hidden />
                Start Import
              </button>
              <button type="button" className="jobsPage__btnReset" onClick={resetAiidImport}>
                Reset
              </button>
            </div>
          </div>
        </section>
      ) : null}

      <section className="jobsPage__filters" aria-label="Filter jobs">
        <div className="jobsPage__filter">
          <label htmlFor={filterId("status")}>STATUS</label>
          <select
            id={filterId("status")}
            value={status}
            onChange={(e) => setStatus(e.target.value)}
          >
            <option value="all">All</option>
            <option value="pending">Pending</option>
            <option value="running">Running</option>
            <option value="completed">Completed</option>
            <option value="failed">Failed</option>
            <option value="skipped">Skipped</option>
          </select>
        </div>
        {tab === "regular" ? (
          <div className="jobsPage__filter">
            <label htmlFor={filterId("type")}>TYPE</label>
            <select id={filterId("type")} value={type} onChange={(e) => setType(e.target.value)}>
              <option value="all">All</option>
              <option value="crawler">Crawler</option>
              <option value="indexer">Indexer</option>
              <option value="ingest">Ingest</option>
            </select>
          </div>
        ) : null}
        <div className="jobsPage__filter">
          <label htmlFor={filterId("source")}>SOURCE</label>
          <select
            id={filterId("source")}
            value={source}
            onChange={(e) => setSource(e.target.value)}
          >
            <option value="all">All</option>
            <option value="rss">RSS</option>
            <option value="api">API</option>
            <option value="manual">Manual</option>
          </select>
        </div>
        <button type="button" className="jobsPage__clearBtn" onClick={clearFilters}>
          Clear Filters
        </button>
        <div className="jobsPage__searchWrap">
          <Search
            className="jobsPage__searchIcon"
            size={18}
            strokeWidth={2}
            aria-hidden
          />
          <input
            id={filterId("search")}
            type="search"
            className="jobsPage__searchInput"
            placeholder="Search URL, ID, status…"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            autoComplete="off"
            enterKeyHint="search"
            aria-label="Search jobs"
          />
        </div>
      </section>

      <section className="jobsPage__tableSection" aria-label="Job list">
        <div className="jobsPage__tableWrap">
          <div className="jobsPage__tableScroll">
            <table className="jobsPage__table">
            <thead>
              <tr>
                <th scope="col" className="jobsPage__th jobsPage__th--left">
                  ID
                </th>
                <th scope="col" className="jobsPage__th jobsPage__th--left">
                  URL
                </th>
                <th scope="col" className="jobsPage__th jobsPage__th--center">
                  STATUS
                </th>
                {tab === "regular" ? (
                  <th scope="col" className="jobsPage__th jobsPage__th--center">
                    TYPE
                  </th>
                ) : null}
                <th scope="col" className="jobsPage__th jobsPage__th--left">
                  SOURCE
                </th>
                <th scope="col" className="jobsPage__th jobsPage__th--left">
                  TRIES
                </th>
                <th scope="col" className="jobsPage__th jobsPage__th--left">
                  CREATED
                </th>
                <th scope="col" className="jobsPage__th jobsPage__th--left">
                  ACTIONS
                </th>
              </tr>
            </thead>
            <tbody>
              {tab === "regular" ? (
                filteredJobRows.length === 0 ? (
                  <tr>
                    <td className="jobsPage__td jobsPage__emptyCell" colSpan={8}>
                      No jobs match your filters or search.
                    </td>
                  </tr>
                ) : (
                  jobPager.pageItems.map((row) => (
                    <tr key={row.id}>
                      <td className="jobsPage__td">
                        <span className="jobsPage__id">#{row.id}</span>
                      </td>
                      <td className="jobsPage__td jobsPage__td--url">
                        <a
                          href={row.url}
                          className="jobsPage__url"
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {row.url}
                        </a>
                      </td>
                      <td className="jobsPage__td jobsPage__td--center jobsPage__td--status">
                        <span className="jobsPage__badge jobsPage__badge--skipped">
                          {row.status}
                        </span>
                      </td>
                      <td className="jobsPage__td jobsPage__td--center jobsPage__td--type">
                        <span className="jobsPage__badge jobsPage__badge--ingest">
                          {row.jobType}
                        </span>
                      </td>
                      <td className="jobsPage__td jobsPage__td--muted">{row.source}</td>
                      <td className="jobsPage__td jobsPage__td--muted">{row.tries}</td>
                      <td className="jobsPage__td jobsPage__td--muted">{row.created}</td>
                      <td className="jobsPage__td">
                        <div className="jobsPage__actions">
                          <button
                            type="button"
                            className="jobsPage__actionLink jobsPage__actionLink--retry"
                          >
                            Retry
                          </button>
                          <button
                            type="button"
                            className="jobsPage__actionLink jobsPage__actionLink--delete"
                          >
                            Delete
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )
              ) : (
                <tr>
                  <td className="jobsPage__td jobsPage__emptyCell" colSpan={7}>
                    {searchQuery.trim()
                      ? "No AIID jobs match your search."
                      : "No AIID jobs to display."}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
          </div>
          {tab === "regular" ? (
            <DataTablePagination
              className="jobsPage__pager"
              page={jobPager.page}
              pageCount={jobPager.pageCount}
              total={jobPager.total}
              pageSize={jobPager.pageSize}
              from={jobPager.from}
              to={jobPager.to}
              onPageChange={jobPager.setPage}
              onPageSizeChange={setJobPageSize}
            />
          ) : null}
        </div>
      </section>
    </main>
  );
}
