import { Fragment, useCallback, useEffect, useId, useMemo, useState } from "react";
import { toast } from "react-toastify";
import {
  Archive,
  ChevronDown,
  ChevronRight,
  Database,
  Plus,
  RefreshCw,
  Search,
} from "lucide-react";
import { AdminDataTable } from "../../AdminDataTable";
import { AdminSortableTh } from "../../AdminSortableTh";
import {
  nextTableSort,
  sortByTableState,
  type TableSortState,
} from "../../adminTableSort";
import { AdminServiceRow } from "../../AdminServiceRow";
import {
  resolveReportsWorkerDisplayStatus,
  type ServiceState,
} from "../../adminServices";
import {
  formatDisplayDate,
  formatDurationMs,
  // formatJobExecutedAt,
  formatRelativeDate,
} from "../../../../../utils/formatDate";
import {
  archiveEtlReportUpload,
  fetchEtlReportUploadItems,
  fetchEtlReportUploads,
  type EtlReportUploadItemRow,
  type EtlReportUploadRow,
} from "../../../../../utils/etlReportsApi";
import {
  fetchReportsLogs,
  type ReportsLogRow,
} from "../../../../../utils/reportsLogsApi";
import { usePagination } from "../../../../../utils/usePagination";
import { uploadEtlReports } from "../etlUpload";
import { ReportsUploadDialog } from "./ReportsUploadDialog";
import { ReportsStartDialog } from "./ReportsStartDialog";
import "../../../Users/usersPage.css";
import "../../adminRssFeeds.css";

interface ReportsTabProps {
  idPrefix: string;
  workerStatus: ServiceState;
  workerApiRunning: boolean;
  onReportsStart: (selection: {
    uploadIds: number[];
    reportIds: number[];
  }) => void;
  onWorkerStop: () => void;
}

const TABLE_COL_SPAN = 7;
const TERMINAL_DISCOVERY_STATUSES = new Set(["EXECUTED", "SKIPPED", "FAILED"]);
const RUNNING_DISCOVERY_STATUSES = new Set(["PENDING", "RUNNING"]);

function itemCountForRow(row: EtlReportUploadRow): number {
  return row.importedRows > 0 ? row.importedRows : row.totalRows;
}

function extractionEndedAt(row: EtlReportUploadRow): string | null {
  if (row.status === "processing") return null;
  return row.updatedAt;
}

type UploadSortKey =
  | "id"
  | "name"
  | "items"
  | "discovery"
  | "added"
  | "extraction";

function getUploadSortValue(
  row: EtlReportUploadRow,
  key: UploadSortKey,
  progress: { completed: number },
): string | number | null {
  switch (key) {
    case "id":
      return row.id;
    case "name":
      return row.suggestedName?.trim() || "";
    case "items":
      return itemCountForRow(row);
    case "discovery":
      return progress.completed;
    case "added":
      return row.createdAt;
    case "extraction": {
      const end = extractionEndedAt(row);
      if (!end) return null;
      return new Date(end).getTime() - new Date(row.createdAt).getTime();
    }
    default:
      return null;
  }
}

function uploadMatchesSearch(row: EtlReportUploadRow, search: string): boolean {
  const q = search.trim().toLowerCase();
  if (!q) return true;

  const hay = [row.id, row.suggestedName ?? ""].join(" ").toLowerCase();
  return hay.includes(q);
}

export function ReportsTab({
  idPrefix,
  workerStatus,
  workerApiRunning,
  onReportsStart,
  onWorkerStop,
}: ReportsTabProps) {
  const baseId = useId();
  const [uploads, setUploads] = useState<EtlReportUploadRow[]>([]);
  const [uploadsLoading, setUploadsLoading] = useState(false);
  const [uploadsRefreshing, setUploadsRefreshing] = useState(false);
  const [uploadDialogOpen, setUploadDialogOpen] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [actionId, setActionId] = useState<number | null>(null);
  const [expandedUploadId, setExpandedUploadId] = useState<number | null>(null);
  const [uploadItemsById, setUploadItemsById] = useState<
    Record<number, EtlReportUploadItemRow[]>
  >({});
  const [uploadItemsLoadingId, setUploadItemsLoadingId] = useState<number | null>(
    null,
  );
  const [startDialogOpen, setStartDialogOpen] = useState(false);
  const [logRows, setLogRows] = useState<ReportsLogRow[]>([]);
  const [logsRefreshing, setLogsRefreshing] = useState(false);
  const [runWarmup, setRunWarmup] = useState(false);
  const [uploadSearchQuery, setUploadSearchQuery] = useState("");
  const [uploadPageSize, setUploadPageSize] = useState(10);
  const [uploadSort, setUploadSort] = useState<TableSortState<UploadSortKey> | null>(
    null,
  );

  const sid = (name: string) => `${idPrefix}-reports-${baseId}-${name}`;

  const latestLogRows = useMemo(() => {
    const latestByReport = new Map<number, ReportsLogRow>();

    for (const row of logRows) {
      const existing = latestByReport.get(row.reportId);
      if (!existing || (row.jobId ?? 0) > (existing.jobId ?? 0)) {
        latestByReport.set(row.reportId, row);
      }
    }

    return [...latestByReport.values()];
  }, [logRows]);

  const hasActiveReportJobs = useMemo(
    () =>
      latestLogRows.some((row) =>
        RUNNING_DISCOVERY_STATUSES.has(row.status.toUpperCase()),
      ),
    [latestLogRows],
  );

  const displayWorkerStatus = useMemo(
    () =>
      resolveReportsWorkerDisplayStatus(
        workerStatus,
        workerApiRunning,
        hasActiveReportJobs,
        { runWarmup },
      ),
    [workerStatus, workerApiRunning, hasActiveReportJobs, runWarmup],
  );

  const discoveryProgressByUpload = useMemo(() => {
    const map = new Map<
      number,
      { total: number; completed: number; running: number }
    >();

    for (const upload of uploads) {
      const itemCount = itemCountForRow(upload);
      if (itemCount > 0) {
        map.set(upload.id, {
          total: itemCount,
          completed: 0,
          running: 0,
        });
      }
    }

    for (const row of latestLogRows) {
      if (!row.uploadId) continue;
      const current = map.get(row.uploadId);
      if (!current) continue;
      const status = row.status.toUpperCase();
      if (TERMINAL_DISCOVERY_STATUSES.has(status)) {
        current.completed += 1;
      } else if (RUNNING_DISCOVERY_STATUSES.has(status)) {
        current.running += 1;
      }
      map.set(row.uploadId, current);
    }

    return map;
  }, [uploads, latestLogRows]);

  const filteredUploads = useMemo(
    () => uploads.filter((row) => uploadMatchesSearch(row, uploadSearchQuery)),
    [uploads, uploadSearchQuery],
  );

  const sortedUploads = useMemo(() => {
    if (!uploadSort) return filteredUploads;

    return sortByTableState(filteredUploads, uploadSort, (row, key) =>
      getUploadSortValue(
        row,
        key,
        discoveryProgressByUpload.get(row.id) ?? { completed: 0 },
      ),
    );
  }, [filteredUploads, uploadSort, discoveryProgressByUpload]);

  const uploadPager = usePagination({
    items: sortedUploads,
    pageSize: uploadPageSize,
    resetKey: `${uploadSearchQuery}|${uploadSort?.key ?? ""}|${uploadSort?.direction ?? ""}`,
  });

  const uploadPageRows = uploadPager.pageItems ?? [];

  const loadReportsLogs = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (silent) setLogsRefreshing(true);

    const result = await fetchReportsLogs();

    if (silent) setLogsRefreshing(false);

    if (!result.ok) {
      if (!silent) {
        toast.error(result.message, { autoClose: 3000 });
      }
      return;
    }

    setLogRows(result.logs);
  }, []);

  const loadUploads = useCallback(async (options?: { silent?: boolean }) => {
    const silent = options?.silent ?? false;
    if (!silent) setUploadsLoading(true);
    else setUploadsRefreshing(true);

    const result = await fetchEtlReportUploads();

    if (!silent) setUploadsLoading(false);
    else setUploadsRefreshing(false);

    if (!result.ok) {
      toast.error(result.message, { autoClose: 3000 });
      return;
    }

    setUploads(result.uploads);
  }, []);

  useEffect(() => {
    void loadUploads();
    void loadReportsLogs();
  }, [loadUploads, loadReportsLogs]);

  useEffect(() => {
    if (!uploads.some((row) => row.status === "processing")) return;

    const timer = window.setInterval(() => {
      void loadUploads({ silent: true });
    }, 3000);

    return () => window.clearInterval(timer);
  }, [uploads, loadUploads]);

  useEffect(() => {
    if (!runWarmup) return;
    const timer = window.setTimeout(() => setRunWarmup(false), 5000);
    return () => window.clearTimeout(timer);
  }, [runWarmup]);

  useEffect(() => {
    if (!workerApiRunning && workerStatus !== "starting") return;

    void loadReportsLogs({ silent: true });

    const pollMs =
      hasActiveReportJobs || runWarmup || workerStatus === "starting"
        ? 2000
        : 7000;
    const timer = window.setInterval(() => {
      void loadReportsLogs({ silent: true });
    }, pollMs);

    return () => window.clearInterval(timer);
  }, [
    workerApiRunning,
    workerStatus,
    hasActiveReportJobs,
    runWarmup,
    loadReportsLogs,
  ]);

  useEffect(() => {
    if (workerApiRunning || workerStatus === "starting") return;
    void loadReportsLogs({ silent: true });
    setRunWarmup(false);
  }, [workerApiRunning, workerStatus, loadReportsLogs]);

  async function handleUploadSubmit({
    suggestedName,
    file,
  }: {
    suggestedName: string;
    file: File;
  }) {
    setUploading(true);

    const result = await uploadEtlReports(file, suggestedName);

    setUploading(false);

    if (result.ok) {
      setUploadDialogOpen(false);
      setUploadItemsById({});
      toast.success(result.message, { autoClose: 2800 });
      void loadUploads({ silent: true });
      return;
    }

    toast.error(result.message, { autoClose: 3500 });
    void loadUploads({ silent: true });
  }

  async function handleArchiveUpload(id: number) {
    setActionId(id);
    const result = await archiveEtlReportUpload(id);
    setActionId(null);

    if (!result.ok) {
      toast.error(result.message, { autoClose: 3000 });
      return;
    }

    toast.success("Report upload archived.", { autoClose: 2500 });
    if (expandedUploadId === id) setExpandedUploadId(null);
    setUploadItemsById((prev) => {
      const next = { ...prev };
      delete next[id];
      return next;
    });
    void loadUploads({ silent: true });
  }

  const loadUploadItems = useCallback(async (uploadId: number) => {
    setUploadItemsLoadingId(uploadId);
    const result = await fetchEtlReportUploadItems(uploadId);
    setUploadItemsLoadingId(null);

    if (!result.ok) {
      toast.error(result.message, { autoClose: 3000 });
      return;
    }

    setUploadItemsById((prev) => ({ ...prev, [uploadId]: result.items }));
  }, []);

  useEffect(() => {
    if (expandedUploadId == null) return;
    if (uploadItemsById[expandedUploadId]) return;
    void loadUploadItems(expandedUploadId);
  }, [expandedUploadId, loadUploadItems, uploadItemsById]);

  function toggleUploadDetails(id: number) {
    setExpandedUploadId((prev) => (prev === id ? null : id));
  }

  return (
    <>
      <section className="adminPage__card" aria-labelledby={sid("title")}>
        <div className="adminPage__cardHead">
          <span className="settingsPage__cardIconWrap" aria-hidden>
            <Database size={20} strokeWidth={2} />
          </span>
          <div className="adminPage__cardHeadText">
            <h2 id={sid("title")} className="adminPage__cardTitle">
              ETL Reports Service
            </h2>
            <p className="adminPage__cardHint">
              Import AI Incident Database report records from a CSV or Excel file.
              Upload reports.csv (or .xlsx), then start the worker to queue and
              ingest selected report URLs.
            </p>
          </div>
        </div>
        <ul className="adminPage__serviceList">
          <AdminServiceRow
            label="Reports Worker"
            status={displayWorkerStatus}
            apiRunning={workerApiRunning}
            allowStartWhileIdle
            onStart={() => setStartDialogOpen(true)}
            onStop={onWorkerStop}
          />
        </ul>
      </section>

      <section
        className="adminPage__rssWorkspace"
        aria-labelledby={sid("workspace-title")}
      >
        <h2
          id={sid("workspace-title")}
          className="adminPage__cardTitle adminPage__rssWorkspaceTitle"
        >
          Report uploads
        </h2>

        <AdminDataTable
          ariaLabel="Report uploads"
          wrapClassName="adminPage__tableWrap--links"
          filters={
            <div
              className="adminPage__dataTableToolbar"
              aria-label="Report uploads toolbar"
            >
              <div className="adminPage__dataTableToolbarActions">
                <button
                  type="button"
                  className="usersPage__inviteBtn adminPage__rssRefreshBtn"
                  onClick={() => {
                    void loadUploads({ silent: true });
                    void loadReportsLogs({ silent: true });
                  }}
                  disabled={
                    uploadsLoading || uploadsRefreshing || logsRefreshing
                  }
                  aria-busy={
                    uploadsLoading || uploadsRefreshing || logsRefreshing
                  }
                >
                  <RefreshCw
                    size={18}
                    strokeWidth={2}
                    className={
                      uploadsRefreshing || logsRefreshing
                        ? "pageHeader__refreshIcon--spin"
                        : undefined
                    }
                    aria-hidden
                  />
                  Refresh
                </button>
                <button
                  type="button"
                  className="usersPage__inviteBtn adminPage__rssIngestBtn"
                  onClick={() => setUploadDialogOpen(true)}
                  disabled={uploading}
                  aria-busy={uploading}
                >
                  <Plus size={18} strokeWidth={2} aria-hidden />
                  Upload CSV
                </button>
              </div>
              <div className="adminPage__dataTableToolbarSearch">
                <Search
                  className="adminPage__linksSearchIcon"
                  size={18}
                  strokeWidth={2}
                  aria-hidden
                />
                <input
                  id={sid("uploads-search")}
                  type="search"
                  className="adminPage__linksSearchInput"
                  placeholder="Search ID or suggested name…"
                  value={uploadSearchQuery}
                  onChange={(e) => setUploadSearchQuery(e.target.value)}
                  autoComplete="off"
                  enterKeyHint="search"
                  aria-label="Search by ID or suggested name"
                />
              </div>
            </div>
          }
          pagination={{
            page: uploadPager.page,
            pageCount: uploadPager.pageCount,
            total: uploadPager.total,
            pageSize: uploadPager.pageSize,
            from: uploadPager.from,
            to: uploadPager.to,
            onPageChange: uploadPager.setPage,
            onPageSizeChange: setUploadPageSize,
          }}
        >
              <table className="adminPage__table adminPage__table--links">
                <thead>
                  <tr>
                    <AdminSortableTh
                      label="ID"
                      sortKey="id"
                      sort={uploadSort}
                      onSort={(key) =>
                        setUploadSort((current) => nextTableSort(current, key))
                      }
                      className="adminPage__th--center"
                    />
                    <AdminSortableTh
                      label="Suggested name"
                      sortKey="name"
                      sort={uploadSort}
                      onSort={(key) =>
                        setUploadSort((current) => nextTableSort(current, key))
                      }
                    />
                    <AdminSortableTh
                      label="Items"
                      sortKey="items"
                      sort={uploadSort}
                      onSort={(key) =>
                        setUploadSort((current) => nextTableSort(current, key))
                      }
                      className="adminPage__th--center"
                    />
                    <AdminSortableTh
                      label="Discovery progress"
                      sortKey="discovery"
                      sort={uploadSort}
                      onSort={(key) =>
                        setUploadSort((current) => nextTableSort(current, key))
                      }
                    />
                    <AdminSortableTh
                      label="Added"
                      sortKey="added"
                      sort={uploadSort}
                      onSort={(key) =>
                        setUploadSort((current) => nextTableSort(current, key))
                      }
                    />
                    <AdminSortableTh
                      label="Extraction"
                      sortKey="extraction"
                      sort={uploadSort}
                      onSort={(key) =>
                        setUploadSort((current) => nextTableSort(current, key))
                      }
                      className="adminPage__th--center"
                    />
                    <th
                      scope="col"
                      className="adminPage__th adminPage__th--actions"
                    >
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {uploadsLoading && filteredUploads.length === 0 ? (
                    <tr>
                      <td
                        className="adminPage__td adminPage__emptyCell"
                        colSpan={TABLE_COL_SPAN}
                      >
                        Loading report uploads…
                      </td>
                    </tr>
                  ) : filteredUploads.length === 0 ? (
                    <tr>
                      <td
                        className="adminPage__td adminPage__emptyCell"
                        colSpan={TABLE_COL_SPAN}
                      >
                        {uploadSearchQuery.trim()
                          ? "No uploads match your search."
                          : "No report uploads yet. Upload a CSV or Excel file to get started."}
                      </td>
                    </tr>
                  ) : (
                    uploadPageRows.map((row) => {
                      const busy = actionId === row.id;
                      const isExpanded = expandedUploadId === row.id;
                      const items = itemCountForRow(row);
                      const uploadItems = uploadItemsById[row.id] ?? [];
                      const itemsLoading = uploadItemsLoadingId === row.id;
                      const progress = discoveryProgressByUpload.get(row.id) ?? {
                        total: 0,
                        completed: 0,
                        running: 0,
                      };
                      const completedPercent =
                        progress.total > 0
                          ? Math.round(
                              (progress.completed / progress.total) * 100,
                            )
                          : 0;
                      const extractionEnd = extractionEndedAt(row);
                      const extractionDurationMs =
                        extractionEnd != null
                          ? new Date(extractionEnd).getTime() -
                            new Date(row.createdAt).getTime()
                          : null;
                      const addedRelative = formatRelativeDate(row.createdAt);
                      const addedDate = formatDisplayDate(row.createdAt);

                      return (
                        <Fragment key={row.id}>
                          <tr>
                            <td className="adminPage__td adminPage__th--center">
                              <span
                                className="adminPage__id"
                                title={`Upload ID #${row.id}`}
                              >
                                #{row.id}
                              </span>
                            </td>
                            <td className="adminPage__td adminPage__cellMuted">
                              {row.suggestedName?.trim() || "—"}
                            </td>
                            <td className="adminPage__td adminPage__th--center adminPage__itemsCell">
                              <div className="adminPage__itemsCellWrap">
                                <button
                                  type="button"
                                  className="adminPage__itemsBtn"
                                  onClick={() => toggleUploadDetails(row.id)}
                                  disabled={
                                    items === 0 &&
                                    uploadItems.length === 0 &&
                                    !isExpanded
                                  }
                                  aria-expanded={isExpanded}
                                  aria-label={
                                    items > 0
                                      ? `${items} report URLs`
                                      : "No report URLs"
                                  }
                                >
                                  {isExpanded ? (
                                    <ChevronDown
                                      size={14}
                                      strokeWidth={2}
                                      aria-hidden
                                    />
                                  ) : (
                                    <ChevronRight
                                      size={14}
                                      strokeWidth={2}
                                      aria-hidden
                                    />
                                  )}
                                  {items}
                                </button>
                              </div>
                            </td>
                            <td className="adminPage__td adminPage__discoveryProgressCell">
                              {progress.total > 0 ||
                              progress.completed > 0 ||
                              progress.running > 0 ? (
                                <div
                                  className="adminPage__discoveryProgress"
                                  aria-label={`${progress.completed} completed, ${progress.running} running, ${progress.total} total`}
                                >
                                  <div className="adminPage__discoveryProgressMeta">
                                    <span>
                                      {progress.completed}/{progress.total}{" "}
                                      completed
                                    </span>
                                    {progress.running > 0 ? (
                                      <span>{progress.running} running</span>
                                    ) : progress.completed === progress.total ? (
                                      <span>Complete</span>
                                    ) : null}
                                    {/* <span className="adminPage__cellMuted">Waiting</span> */}
                                  </div>
                                  <div
                                    className="adminPage__discoveryProgressTrack"
                                    role="progressbar"
                                    aria-valuemin={0}
                                    aria-valuemax={progress.total}
                                    aria-valuenow={progress.completed}
                                  >
                                    <span
                                      className="adminPage__discoveryProgressFill"
                                      style={{ width: `${completedPercent}%` }}
                                    />
                                  </div>
                                </div>
                              ) : (
                                <span className="adminPage__cellMuted">
                                  No discovery jobs
                                </span>
                              )}
                            </td>
                            <td className="adminPage__td adminPage__addedAtCell">
                              <div className="adminPage__addedAt">
                                <span>{addedRelative}</span>
                                {addedRelative !== addedDate ? (
                                  <span className="adminPage__cellMuted">
                                    {addedDate}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="adminPage__td adminPage__th--center adminPage__extractionTimesCell">
                              <div className="adminPage__extractionTimes">
                                {/* <span title={row.createdAt}>
                                  Start: {formatJobExecutedAt(row.createdAt)}
                                </span>
                                <span title={extractionEnd ?? undefined}>
                                  End:{" "}
                                  {extractionEnd
                                    ? formatJobExecutedAt(extractionEnd)
                                    : "In progress"}
                                </span> */}
                                {extractionDurationMs != null ? (
                                  <span className="adminPage__cellMuted">
                                    {formatDurationMs(extractionDurationMs)}
                                  </span>
                                ) : null}
                              </div>
                            </td>
                            <td className="adminPage__td">
                              <div className="adminPage__actions">
                                <button
                                  type="button"
                                  className="adminPage__actionBtn adminPage__actionBtn--archive"
                                  data-tooltip="Archive upload"
                                  onClick={() => void handleArchiveUpload(row.id)}
                                  disabled={busy || uploading}
                                  aria-label="Archive upload"
                                >
                                  <Archive
                                    size={16}
                                    strokeWidth={2}
                                    aria-hidden
                                  />
                                </button>
                              </div>
                            </td>
                          </tr>
                          {isExpanded ? (
                            <tr className="adminPage__itemsExpandRow">
                              <td
                                className="adminPage__td"
                                colSpan={TABLE_COL_SPAN}
                              >
                                <div
                                  className="adminPage__itemsPanel"
                                  role="region"
                                  aria-label={`Report URLs for upload #${row.id}`}
                                >
                                  <p className="adminPage__itemsPanelTitle">
                                    Report URLs for upload #{row.id}
                                  </p>
                                  {itemsLoading ? (
                                    <p
                                      className="adminPage__itemsPanelEmpty"
                                      role="status"
                                    >
                                      Loading report URLs…
                                    </p>
                                  ) : uploadItems.length === 0 ? (
                                    <p
                                      className="adminPage__itemsPanelEmpty"
                                      role="status"
                                    >
                                      No URLs found in this upload.
                                    </p>
                                  ) : (
                                    <table className="adminPage__itemsTable">
                                      <thead>
                                        <tr>
                                          <th scope="col">#</th>
                                          <th scope="col">Report URL</th>
                                        </tr>
                                      </thead>
                                      <tbody>
                                        {uploadItems.map((item) => (
                                          <tr key={item.id}>
                                            <td>
                                              <span
                                                className="adminPage__id"
                                                title={`Row ${item.rowOrder}`}
                                              >
                                                #{item.rowOrder}
                                              </span>
                                            </td>
                                            <td>
                                              <a
                                                href={item.url}
                                                className="adminPage__cellUrl"
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                title={item.title ?? item.url}
                                              >
                                                {item.url}
                                              </a>
                                            </td>
                                          </tr>
                                        ))}
                                      </tbody>
                                    </table>
                                  )}
                                </div>
                              </td>
                            </tr>
                          ) : null}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
        </AdminDataTable>
      </section>

      <ReportsUploadDialog
        open={uploadDialogOpen}
        uploading={uploading}
        onClose={() => setUploadDialogOpen(false)}
        onSubmit={(payload) => void handleUploadSubmit(payload)}
      />
      <ReportsStartDialog
        open={startDialogOpen}
        uploads={uploads}
        uploadsLoading={uploadsLoading}
        starting={workerStatus === "starting"}
        onClose={() => setStartDialogOpen(false)}
        onStart={(selection) => {
          setStartDialogOpen(false);
          setRunWarmup(true);
          void loadReportsLogs({ silent: true });
          onReportsStart(selection);
        }}
      />
    </>
  );
}
