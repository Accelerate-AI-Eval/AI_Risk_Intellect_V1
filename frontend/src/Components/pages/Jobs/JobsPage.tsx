import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { toast } from "react-toastify";
import type { LucideIcon } from "lucide-react";
import {
  Activity,
  CheckCircle2,
  Clock,
  FilterX,
  Info,
  ListChecks,
  Plus,
  RefreshCw,
  RotateCw,
  Search,
  Trash2,
  SkipForward,
  Timer,
  Upload,
  XCircle,
  Zap,
  CircleAlert,
} from "lucide-react";
import { authFetch } from "../../../utils/authFetch";
import { formatRelativeDate } from "../../../utils/formatDate";
import { setDocumentPageTitle } from "../../../utils/pageTitle";
import { usePagination } from "../../../utils/usePagination";
import { usePolling } from "../../../utils/usePolling";
import { PageHeader } from "../../Layout/PageHeader";
import { DataTablePagination } from "../../common/DataTablePagination";
import { UrlIngestionDialog } from "../../common/UrlIngestionDialog";
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

type JobRow = {
  id: number;
  url: string;
  status: string;
  jobType: string;
  source: string;
  tries: string;
  created: string;
  createdAt: string;
  errorMessage: string;
};

type JobMetrics = {
  total: number;
  successRate: number;
  pending: number;
  failed: number;
  running: number;
  completed24h: number;
  avgProcessingSeconds: number;
  skipped: number;
};

function labelize(value: string): string {
  return value.replace(/_/g, " ").toUpperCase();
}

/** Map deprecated API statuses to current labels for display and filters. */
function normalizeJobStatus(status: string): string {
  switch (status.toLowerCase()) {
    case "completed":
      return "done";
    case "failed":
      return "error";
    default:
      return status;
  }
}

function capitalize(value: string): string {
  if (!value) return value;
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function statusBadgeClass(status: string): string {
  switch (status.toLowerCase()) {
    case "pending":
      return "jobsPage__badge jobsPage__badge--ingest";
    case "running":
      return "jobsPage__badge jobsPage__badge--ingest";
    case "done":
      return "jobsPage__badge jobsPage__badge--ingest";
    case "error":
      return "jobsPage__badge jobsPage__badge--skipped";
    case "skipped":
      return "jobsPage__badge jobsPage__badge--skipped";
    default:
      return "jobsPage__badge jobsPage__badge--skipped";
  }
}

function typeBadgeClass(jobType: string): string {
  return jobType.toLowerCase() === "ingest"
    ? "jobsPage__badge jobsPage__badge--ingest"
    : "jobsPage__badge jobsPage__badge--skipped";
}

function buildMetrics(m: JobMetrics): Metric[] {
  return [
    { key: "total", label: "TOTAL JOBS", value: String(m.total), accent: "blue", Icon: ListChecks },
    { key: "success", label: "SUCCESS RATE", value: `${m.successRate}%`, accent: "green", Icon: CheckCircle2 },
    { key: "pending", label: "PENDING QUEUE", value: String(m.pending), accent: "amber", Icon: Clock },
    { key: "failed", label: "FAILED JOBS", value: String(m.failed), accent: "red", Icon: XCircle },
    { key: "running", label: "RUNNING NOW", value: String(m.running), accent: "slate", Icon: Zap },
    { key: "completed24h", label: "24H COMPLETED", value: String(m.completed24h), accent: "slate", Icon: Activity },
    {
      key: "avgProc",
      label: "AVG PROCESSING",
      value: m.avgProcessingSeconds > 0 ? `${m.avgProcessingSeconds}s` : "0s",
      accent: "slate",
      Icon: Timer,
    },
    { key: "skipped", label: "SKIPPED", value: String(m.skipped), accent: "slate", Icon: SkipForward },
  ];
}

type StatusHelpItem = { status: string; description: string };

const JOB_STATUS_HELP_BY_KEY: Record<string, StatusHelpItem> = {
  pending: {
    status: "Pending",
    description: "Queued and waiting for the worker to pick it up.",
  },
  running: {
    status: "Running",
    description: "The worker is actively processing this job.",
  },
  done: {
    status: "Done",
    description: "Finished successfully; content was ingested or processed.",
  },
  skipped: {
    status: "Skipped",
    description:
      "Finished without storing content (duplicate URL, fetch failed, not AI-related, etc.).",
  },
  error: {
    status: "Error",
    description: "Failed due to an unexpected error; may be retried.",
  },
};

const JOB_STATUS_HELP_ALL: StatusHelpItem[] = [
  JOB_STATUS_HELP_BY_KEY.pending,
  JOB_STATUS_HELP_BY_KEY.running,
  JOB_STATUS_HELP_BY_KEY.done,
  JOB_STATUS_HELP_BY_KEY.skipped,
  JOB_STATUS_HELP_BY_KEY.error,
];

function statusHelpFor(displayStatus: string): StatusHelpItem | undefined {
  return JOB_STATUS_HELP_BY_KEY[displayStatus.toLowerCase().trim()];
}

function StatusHelpIcon({
  placement = "below",
  status,
}: {
  placement?: "above" | "below";
  status?: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const rowHelp = status ? statusHelpFor(status) : undefined;
  const items = rowHelp ? [rowHelp] : JOB_STATUS_HELP_ALL;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  const ariaLabel = rowHelp
    ? `What does ${rowHelp.status} mean?`
    : "What do job statuses mean?";

  return (
    <div ref={wrapRef} className="jobsPage__statusHelp">
      <button
        type="button"
        className="jobsPage__statusHelpBtn"
        aria-label={ariaLabel}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <Info size={14} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={rowHelp ? `${rowHelp.status} definition` : "Job status definitions"}
          className={`jobsPage__statusHelpPanel jobsPage__statusHelpPanel--${placement}${rowHelp ? " jobsPage__statusHelpPanel--single" : ""}`}
        >
          <p className="jobsPage__statusHelpTitle">
            {rowHelp ? rowHelp.status : "Job statuses"}
          </p>
          <ul className="jobsPage__statusHelpList">
            {items.map((item) => (
              <li key={item.status}>
                {!rowHelp ? (
                  <span className="jobsPage__statusHelpTerm">{item.status}</span>
                ) : null}
                <span className="jobsPage__statusHelpDesc">{item.description}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}
    </div>
  );
}

const JOB_ISSUE_DEFAULT_MESSAGE: Record<string, string> = {
  skipped:
    "This job finished without storing content or risks. No detailed reason was recorded.",
  error: "This job failed with an unexpected error. No detailed reason was recorded.",
};

function jobHasIssueInfo(status: string): boolean {
  const s = status.toLowerCase();
  return s === "skipped" || s === "error";
}

function JobErrorInfoIcon({
  jobId,
  status,
  message,
}: {
  jobId: number;
  status: string;
  message: string;
}) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  const panelId = useId();
  const statusKey = status.toLowerCase();
  const hasIssue = jobHasIssueInfo(status);
  const body =
    message.trim() ||
    (hasIssue ? JOB_ISSUE_DEFAULT_MESSAGE[statusKey] ?? "" : "");

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  if (!hasIssue) {
    return <span className="jobsPage__infoEmpty" aria-hidden="true">—</span>;
  }

  const toneClass =
    statusKey === "error" ? " jobsPage__errorInfoBtn--failed" : "";

  return (
    <div ref={wrapRef} className="jobsPage__errorInfo">
      <button
        type="button"
        className={`jobsPage__errorInfoBtn${toneClass}${open ? " jobsPage__errorInfoBtn--open" : ""}`}
        aria-label={`Why job #${jobId} was not fully processed`}
        aria-expanded={open}
        aria-controls={panelId}
        onClick={() => setOpen((v) => !v)}
      >
        <CircleAlert size={16} strokeWidth={2} aria-hidden />
      </button>
      {open ? (
        <div
          id={panelId}
          role="dialog"
          aria-label={`Job #${jobId} processing details`}
          className="jobsPage__errorInfoPanel jobsPage__errorInfoPanel--below"
        >
          <p className="jobsPage__errorInfoTitle">Why this URL was not processed</p>
          <p className="jobsPage__errorInfoMeta">
            Job #{jobId} · {status}
          </p>
          <p className="jobsPage__errorInfoBody">{body}</p>
        </div>
      ) : null}
    </div>
  );
}

const EMPTY_METRICS: JobMetrics = {
  total: 0,
  successRate: 0,
  pending: 0,
  failed: 0,
  running: 0,
  completed24h: 0,
  avgProcessingSeconds: 0,
  skipped: 0,
};

function normalizeJobsFromApi(raw: unknown): { jobs: JobRow[]; metrics: JobMetrics } {
  const data = raw as {
    jobs?: Array<{
      id?: number;
      url?: string;
      status?: string;
      jobType?: string;
      source?: string;
      tries?: number;
      errorMessage?: string | null;
      createdAt?: string;
    }>;
    metrics?: Partial<JobMetrics>;
  };

  const jobs: JobRow[] = (data.jobs ?? []).map((j) => ({
    id: j.id ?? 0,
    url: j.url ?? "",
    status: labelize(normalizeJobStatus(j.status ?? "")),
    jobType: labelize(j.jobType ?? ""),
    source: capitalize(j.source ?? ""),
    tries: String(j.tries ?? 0),
    created: j.createdAt ? formatRelativeDate(j.createdAt) : "—",
    createdAt: j.createdAt ?? "",
    errorMessage: (j.errorMessage ?? "").trim(),
  }));

  return {
    jobs,
    metrics: {
      total: data.metrics?.total ?? jobs.length,
      successRate: data.metrics?.successRate ?? 0,
      pending: data.metrics?.pending ?? 0,
      failed: data.metrics?.failed ?? 0,
      running: data.metrics?.running ?? 0,
      completed24h: data.metrics?.completed24h ?? 0,
      avgProcessingSeconds: data.metrics?.avgProcessingSeconds ?? 0,
      skipped: data.metrics?.skipped ?? 0,
    },
  };
}

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
    String(row.id),
    row.url,
    row.status,
    row.jobType,
    row.source,
    row.tries,
    row.created,
    row.errorMessage,
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
  const [enqueueOpen, setEnqueueOpen] = useState(false);
  const [rows, setRows] = useState<JobRow[]>([]);
  const [metrics, setMetrics] = useState<JobMetrics>(EMPTY_METRICS);
  const [loadState, setLoadState] = useState<"idle" | "loading" | "error">(
    "idle",
  );

  const loadJobs = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    const token = sessionStorage.getItem("accessToken");
    if (!token) {
      setRows([]);
      setLoadState("idle");
      return;
    }

    if (!silent) {
      setLoadState("loading");
    }
    try {
      const res = await authFetch("/jobs");
      const data = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      if (res.status === 401) {
        setLoadState("idle");
        return;
      }
      if (!res.ok) {
        if (!silent) {
          setLoadState("error");
          toast.error(data.error?.message ?? "Could not load jobs.", {
            autoClose: 3000,
          });
        }
        return;
      }
      const parsed = normalizeJobsFromApi(data);
      setRows(parsed.jobs);
      setMetrics(parsed.metrics);
      setLoadState("idle");
    } catch {
      if (!silent) {
        setLoadState("error");
        toast.error("Network error while loading jobs.", { autoClose: 3000 });
      }
    }
  }, []);

  useEffect(() => {
    setDocumentPageTitle(tab === "aiid" ? "AIID Jobs" : "Jobs");
  }, [tab]);

  useEffect(() => {
    void loadJobs();
  }, [loadJobs]);

  const hasActiveJobs = metrics.pending > 0 || metrics.running > 0;
  const pollIntervalMs = hasActiveJobs ? 3_000 : 10_000;

  usePolling(
    () => loadJobs({ silent: true }),
    pollIntervalMs,
    tab === "regular",
  );

  const displayMetrics = useMemo(() => buildMetrics(metrics), [metrics]);

  const filteredJobRows = useMemo(() => {
    if (tab !== "regular") return [];
    return rows.filter((row) =>
      jobMatchesFilters(row, status, type, source, searchQuery),
    );
  }, [tab, rows, status, type, source, searchQuery]);

  const jobPager = usePagination({
    items: tab === "regular" ? filteredJobRows : [],
    pageSize: jobPageSize,
    resetKey: `${tab}|${status}|${type}|${source}|${searchQuery}`,
  });

  const handleRefresh = useCallback(async () => {
    setRefreshing(true);
    await loadJobs();
    setRefreshing(false);
    toast.success("Job stats refreshed.", { autoClose: 2000 });
  }, [loadJobs]);

  const handleRetryJob = useCallback(
    async (jobId: number) => {
      try {
        const res = await authFetch(`/jobs/${jobId}/retry`, { method: "POST" });
        const data = (await res.json().catch(() => ({}))) as {
          message?: string;
          error?: { message?: string };
        };
        if (!res.ok) {
          toast.error(data.error?.message ?? "Could not retry job.", {
            autoClose: 3500,
          });
          return;
        }
        toast.success(data.message ?? "Job requeued.", { autoClose: 2500 });
        await loadJobs();
      } catch {
        toast.error("Network error while retrying job.", { autoClose: 3000 });
      }
    },
    [loadJobs],
  );

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
      <PageHeader
        title="Jobs"
        subtitle="Monitor and manage crawler jobs"
        actions={
          <>
            <button
              type="button"
              className="usersPage__inviteBtn"
              onClick={() => setEnqueueOpen(true)}
            >
              <Plus size={18} strokeWidth={2} aria-hidden />
              Enqueue
            </button>
            <button
              type="button"
              className="usersPage__inviteBtn"
              onClick={() => void handleRefresh()}
              disabled={refreshing || loadState === "loading"}
              aria-busy={refreshing || loadState === "loading"}
            >
              <RefreshCw
                size={18}
                strokeWidth={2}
                className={refreshing ? "pageHeader__refreshIcon--spin" : undefined}
                aria-hidden
              />
              Refresh
            </button>
          </>
        }
      />

      <UrlIngestionDialog
        open={enqueueOpen}
        onClose={() => setEnqueueOpen(false)}
        onEnqueued={() => void loadJobs()}
      />

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

      <div className="jobsPage__grid">
        {displayMetrics.map((m) => (
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
            <option value="done">Done</option>
            <option value="error">Error</option>
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
        <button
          type="button"
          className="jobsPage__clearBtn"
          onClick={clearFilters}
          aria-label="Clear Filter"
          data-tooltip="Clear Filter"
        >
          <FilterX size={18} strokeWidth={2} aria-hidden />
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
                <th
                  scope="col"
                  className="jobsPage__th jobsPage__th--center jobsPage__th--info"
                  aria-label="Processing details"
                >
                  INFO
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
                loadState === "loading" ? (
                  <tr>
                    <td className="jobsPage__td jobsPage__emptyCell" colSpan={9}>
                      Loading jobs…
                    </td>
                  </tr>
                ) : filteredJobRows.length === 0 ? (
                  <tr>
                    <td className="jobsPage__td jobsPage__emptyCell" colSpan={9}>
                      {searchQuery.trim()
                        ? "No jobs match your filters or search."
                        : loadState === "error"
                          ? "Could not load jobs."
                          : "No jobs to display."}
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
                        <div className="jobsPage__statusCell">
                          <span className={statusBadgeClass(row.status)}>
                            {row.status}
                          </span>
                          <StatusHelpIcon status={row.status} />
                        </div>
                      </td>
                      <td className="jobsPage__td jobsPage__td--center jobsPage__td--type">
                        <span className={typeBadgeClass(row.jobType)}>
                          {row.jobType}
                        </span>
                      </td>
                      <td className="jobsPage__td jobsPage__td--muted">{row.source}</td>
                      <td className="jobsPage__td jobsPage__td--muted">{row.tries}</td>
                      <td className="jobsPage__td jobsPage__td--center jobsPage__td--info">
                        <JobErrorInfoIcon
                          jobId={row.id}
                          status={row.status}
                          message={row.errorMessage}
                        />
                      </td>
                      <td className="jobsPage__td jobsPage__td--muted">{row.created}</td>
                      <td className="jobsPage__td">
                        <div className="jobsPage__actions">
                          <button
                            type="button"
                            className="jobsPage__actionBtn jobsPage__actionBtn--retry"
                            aria-label="Retry"
                            data-tooltip="Retry"
                            onClick={() => void handleRetryJob(row.id)}
                          >
                            <RotateCw size={16} strokeWidth={2} aria-hidden />
                          </button>
                          <button
                            type="button"
                            className="jobsPage__actionBtn jobsPage__actionBtn--delete"
                            aria-label="Delete"
                            data-tooltip="Delete"
                          >
                            <Trash2 size={16} strokeWidth={2} aria-hidden />
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
