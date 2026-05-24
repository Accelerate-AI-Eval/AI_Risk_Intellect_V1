import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  Cpu,
  Database,
  Download,
  Play,
  RotateCw,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { authFetch } from "../../../utils/authFetch";
import { setDocumentPageTitle } from "../../../utils/pageTitle";
import { PageHeader } from "../../Layout/PageHeader";
import {
  SettingsAboutSection,
  SettingsApiSection,
  SettingsSections,
} from "../Settings/SettingsSections";
import "../Users/usersPage.css";
import "../Settings/settingsPage.css";
import "./adminPage.css";

type ServiceKey = "worker" | "discovery";
type ApiServiceState = "stopped" | "running";
type ServiceState = ApiServiceState | "starting" | "stopping";
type PendingAction = "starting" | "stopping";

const DEFAULT_API_STATUS: Record<ServiceKey, ApiServiceState> = {
  worker: "stopped",
  discovery: "stopped",
};

function serviceStatusLabel(status: ServiceState): string {
  switch (status) {
    case "starting":
      return "Starting...";
    case "stopping":
      return "Stopping...";
    case "running":
      return "Running";
    default:
      return "Stopped";
  }
}

function serviceStatusPillClass(status: ServiceState): string {
  switch (status) {
    case "running":
      return "adminPage__statusPill--running";
    case "starting":
    case "stopping":
      return "adminPage__statusPill--pending";
    default:
      return "adminPage__statusPill--stopped";
  }
}

function isServiceBusy(status: ServiceState): boolean {
  return status === "starting" || status === "stopping";
}

function displayServiceStatus(
  key: ServiceKey,
  apiStatus: Record<ServiceKey, ApiServiceState>,
  pending: Partial<Record<ServiceKey, PendingAction>>,
): ServiceState {
  return pending[key] ?? apiStatus[key];
}

async function readServiceApiStatus(): Promise<Record<
  ServiceKey,
  ApiServiceState
> | null> {
  const res = await authFetch("/admin/services/status");
  if (!res.ok) return null;
  const data = (await res.json()) as {
    services?: Record<string, { running?: boolean }>;
  };
  return {
    worker:
      data.services?.worker?.running === true ? "running" : "stopped",
    discovery:
      data.services?.discovery?.running === true ? "running" : "stopped",
  };
}

async function waitForServiceApiState(
  key: ServiceKey,
  expectRunning: boolean,
  maxMs = 30_000,
): Promise<boolean> {
  const deadline = Date.now() + maxMs;
  while (Date.now() < deadline) {
    const status = await readServiceApiStatus();
    if (status) {
      const running = status[key] === "running";
      if (running === expectRunning) return true;
    }
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return false;
}

const SERVICE_ROWS: { key: ServiceKey; label: string }[] = [
  { key: "worker", label: "Worker Service" },
  { key: "discovery", label: "Discovery Service" },
];

export function AdminPage() {
  const baseId = useId();
  const [apiStatus, setApiStatus] =
    useState<Record<ServiceKey, ApiServiceState>>(DEFAULT_API_STATUS);
  const [pendingAction, setPendingAction] = useState<
    Partial<Record<ServiceKey, PendingAction>>
  >({});
  // const [incidentsFile, setIncidentsFile] = useState<File | null>(null);
  // const [reportsFile, setReportsFile] = useState<File | null>(null);
  // const [dryRun, setDryRun] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [resetConfirm, setResetConfirm] = useState("");

  useEffect(() => {
    setDocumentPageTitle("Controls");
  }, []);

  const loadServiceStatus = useCallback(async () => {
    const token = sessionStorage.getItem("accessToken");
    if (!token) return;

    try {
      const status = await readServiceApiStatus();
      if (status) {
        setApiStatus(status);
      }
    } catch {
      // ignore polling errors
    }
  }, []);

  useEffect(() => {
    void loadServiceStatus();
    const timer = window.setInterval(() => void loadServiceStatus(), 10_000);
    return () => window.clearInterval(timer);
  }, [loadServiceStatus]);

  const fid = (name: string) => `${baseId}-${name}`;

  const stub = useCallback((action: string) => {
    toast.info(`${action} is not connected to the API yet.`, {
      autoClose: 3200,
    });
  }, []);

  const clearPending = useCallback((key: ServiceKey) => {
    setPendingAction((pending) => {
      if (!pending[key]) return pending;
      const next = { ...pending };
      delete next[key];
      return next;
    });
  }, []);

  const handleStart = async (key: ServiceKey) => {
    const path =
      key === "worker"
        ? "/admin/services/worker/start"
        : "/admin/services/discovery/start";

    setPendingAction((pending) => ({ ...pending, [key]: "starting" }));

    try {
      const res = await authFetch(path, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        message?: string;
        error?: { message?: string };
      };
      if (!res.ok) {
        clearPending(key);
        toast.error(
          data.error?.message ??
            `Could not start ${key === "worker" ? "worker" : "discovery"} service.`,
          { autoClose: 3500 },
        );
        void loadServiceStatus();
        return;
      }

      const started = await waitForServiceApiState(key, true);
      clearPending(key);
      void loadServiceStatus();

      if (!started) {
        toast.warning(
          "Start requested, but the service has not reported running yet.",
          { autoClose: 4000 },
        );
        return;
      }

      toast.success(data.message ?? "Service started.", {
        autoClose: 2500,
      });
    } catch {
      clearPending(key);
      void loadServiceStatus();
      toast.error("Network error while starting service.", { autoClose: 3000 });
    }
  };

  const handleStop = async (key: ServiceKey) => {
    const path =
      key === "worker"
        ? "/admin/services/worker/stop"
        : "/admin/services/discovery/stop";

    setPendingAction((pending) => ({ ...pending, [key]: "stopping" }));

    try {
      const res = await authFetch(path, {
        method: "POST",
      });
      const data = (await res.json().catch(() => ({}))) as {
        error?: { message?: string };
      };
      if (!res.ok) {
        clearPending(key);
        toast.error(
          data.error?.message ??
            `Could not stop ${key === "worker" ? "worker" : "discovery"} service.`,
          { autoClose: 3500 },
        );
        void loadServiceStatus();
        return;
      }

      const stopped = await waitForServiceApiState(key, false);
      clearPending(key);
      void loadServiceStatus();

      if (!stopped) {
        toast.warning(
          "Stop requested, but the service has not reported stopped yet.",
          { autoClose: 4000 },
        );
        return;
      }

      toast.success("Stopped successfully.", { autoClose: 2500 });
    } catch {
      clearPending(key);
      void loadServiceStatus();
      toast.error("Network error while stopping service.", { autoClose: 3000 });
    }
  };

  // const handleAiidImport = () => {
  //   if (!incidentsFile && !reportsFile) {
  //     toast.error("Select at least one CSV file.", { autoClose: 2500 });
  //     return;
  //   }
  //   stub(
  //     dryRun
  //       ? "AIID import (dry run)"
  //       : "AIID import",
  //   );
  // };

  const handleExportExcel = () => stub("Export risks to Excel");

  const handleRestore = () => {
    if (!backupFile) {
      toast.error("Select a backup file to restore.", { autoClose: 2500 });
      return;
    }
    stub("Restore backup");
  };

  const handleResetDatabase = () => {
    if (resetConfirm !== "RESET") return;
    stub("Reset database");
    setResetConfirm("");
  };

  const resetEnabled = resetConfirm === "RESET";

  return (
    <main className="mainLayout__content adminPage">
      <PageHeader
        title="Controls"
        subtitle="System controls, settings, and data management"
      />

      <div className="adminPage__topRow">
        <section className="adminPage__card adminPage__topRowCell" aria-labelledby={fid("services-title")}>
        <div className="adminPage__cardHead">
          <span className="settingsPage__cardIconWrap" aria-hidden>
            <Cpu size={20} strokeWidth={2} />
          </span>
          <div className="adminPage__cardHeadText">
            <h2 id={fid("services-title")} className="adminPage__cardTitle">
              System services
            </h2>
            <p className="adminPage__cardHint">
              Start and stop background processing services.
            </p>
          </div>
        </div>
        <ul className="adminPage__serviceList">
          {SERVICE_ROWS.map((row) => {
            const status = displayServiceStatus(
              row.key,
              apiStatus,
              pendingAction,
            );
            const busy = isServiceBusy(status);
            const canStart = !busy && apiStatus[row.key] === "stopped";
            const canStop = !busy && apiStatus[row.key] === "running";
            return (
              <li key={row.key} className="adminPage__serviceRow">
                <span className="adminPage__serviceName">{row.label}</span>
                <span
                  role="status"
                  className={`adminPage__statusPill ${serviceStatusPillClass(status)}`}
                  aria-live="polite"
                >
                  <span className="adminPage__statusPillDot" aria-hidden />
                  {serviceStatusLabel(status)}
                </span>
                <div className="adminPage__serviceActions">
                  <button
                    type="button"
                    className="usersPage__btn usersPage__btn--primary usersPage__btn--inviteSend"
                    onClick={() => void handleStart(row.key)}
                    disabled={!canStart || busy}
                  >
                    <Play size={16} strokeWidth={2} aria-hidden />
                    Start
                  </button>
                  <button
                    type="button"
                    className="usersPage__btn usersPage__btn--logoutTone"
                    onClick={() => void handleStop(row.key)}
                    disabled={!canStop || busy}
                  >
                    <Square size={14} strokeWidth={2} aria-hidden />
                    Stop
                  </button>
                </div>
              </li>
            );
          })}
        </ul>
      </section>

        <div className="settingsPage adminPage__topRowCell">
          <SettingsApiSection />
        </div>
      </div>

      <div className="settingsPage adminPage__settings">
        <SettingsSections />
      </div>

      {/* AIID import — disabled until API is connected
      <section className="adminPage__card" aria-labelledby={fid("aiid-title")}>
          <div className="adminPage__cardHead">
            <span className="adminPage__cardIconWrap" aria-hidden>
              <Upload size={20} strokeWidth={2} />
            </span>
            <div className="adminPage__cardHeadText">
              <h2 id={fid("aiid-title")} className="adminPage__cardTitle">
                AIID import
              </h2>
              <p className="adminPage__cardHint">
                Import AI Incident Database CSV files.
              </p>
            </div>
          </div>
          <div className="adminPage__fileFields">
            <div className="adminPage__fileField">
              <label className="adminPage__fileLabel" htmlFor={fid("incidents")}>
                incidents.csv
              </label>
              <input
                id={fid("incidents")}
                type="file"
                accept=".csv,text/csv"
                className="adminPage__fileInput"
                onChange={(e) =>
                  setIncidentsFile(e.target.files?.[0] ?? null)
                }
              />
            </div>
            <div className="adminPage__fileField">
              <label className="adminPage__fileLabel" htmlFor={fid("reports")}>
                reports.csv
              </label>
              <input
                id={fid("reports")}
                type="file"
                accept=".csv,text/csv"
                className="adminPage__fileInput"
                onChange={(e) => setReportsFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <label className="adminPage__check">
              <input
                type="checkbox"
                checked={dryRun}
                onChange={(e) => setDryRun(e.target.checked)}
              />
              <span>Dry run (preview only)</span>
            </label>
          </div>
          <div className="adminPage__cardFoot">
            <button
              type="button"
              className="usersPage__inviteBtn"
              onClick={handleAiidImport}
            >
              <Upload size={18} strokeWidth={2} aria-hidden />
              Import
            </button>
          </div>
      </section>
      */}

      <section className="adminPage__card" aria-labelledby={fid("data-title")}>
        <div className="adminPage__cardHead">
          <span className="settingsPage__cardIconWrap" aria-hidden>
            <Database size={20} strokeWidth={2} />
          </span>
          <div className="adminPage__cardHeadText">
            <h2 id={fid("data-title")} className="adminPage__cardTitle">
              Data management
            </h2>
            <p className="adminPage__cardHint">
              Export, backup, restore, or reset the database.
            </p>
          </div>
        </div>
        <div className="adminPage__dataGrid">
          <div className="adminPage__dataCol">
            <h3 className="adminPage__dataColTitle">
              <Download size={16} strokeWidth={2} aria-hidden />
              Export risks
            </h3>
            <p className="adminPage__dataColDesc">
              Download all risks as an Excel spreadsheet with Risks, Articles, and
              Tags sheets.
            </p>
            <button
              type="button"
              className="adminPage__ghostBtn"
              onClick={handleExportExcel}
            >
              <Download size={18} strokeWidth={2} aria-hidden />
              Export to Excel
            </button>
          </div>
          <div className="adminPage__dataCol">
            <h3 className="adminPage__dataColTitle">
              <RotateCw size={16} strokeWidth={2} aria-hidden />
              Restore backup
            </h3>
            <div className="adminPage__fileField adminPage__fileField--tight">
              <label className="adminPage__visuallyHidden" htmlFor={fid("backup")}>
                Backup file
              </label>
              <input
                id={fid("backup")}
                type="file"
                className="adminPage__fileInput"
                onChange={(e) => setBackupFile(e.target.files?.[0] ?? null)}
              />
            </div>
            <button
              type="button"
              className="adminPage__ghostBtn"
              onClick={handleRestore}
            >
              <Upload size={18} strokeWidth={2} aria-hidden />
              Restore
            </button>
          </div>
          <div className="adminPage__dataCol adminPage__dataCol--danger">
            <h3 className="adminPage__dataColTitle">
              <Trash2 size={16} strokeWidth={2} aria-hidden />
              Reset database
            </h3>
            <p className="adminPage__dataColDesc">
              Permanently deletes all articles, risks, and jobs. This cannot be
              undone.
            </p>
            <input
              type="text"
              className="adminPage__dangerInput"
              placeholder='Type "RESET" to confirm'
              value={resetConfirm}
              onChange={(e) => setResetConfirm(e.target.value)}
              autoComplete="off"
              aria-label="Type RESET to confirm database reset"
            />
            <button
              type="button"
              className="adminPage__dangerBtn"
              disabled={!resetEnabled}
              onClick={handleResetDatabase}
            >
              <AlertTriangle size={18} strokeWidth={2} aria-hidden />
              Reset Database
            </button>
          </div>
        </div>
      </section>

      <div className="settingsPage adminPage__settingsAbout">
        <SettingsAboutSection />
      </div>
    </main>
  );
}
