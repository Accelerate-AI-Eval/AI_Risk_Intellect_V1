import { useCallback, useEffect, useId, useState } from "react";
import { toast } from "react-toastify";
import {
  AlertTriangle,
  Cpu,
  Database,
  Download,
  Link2,
  Play,
  RotateCw,
  Square,
  Trash2,
  Upload,
} from "lucide-react";
import { setDocumentPageTitle } from "../../../utils/pageTitle";
import { PageHeading } from "../../Layout/PageHeading";
import "../Users/usersPage.css";
import "./adminPage.css";

type ServiceKey = "worker" | "discovery";
type ServiceState = "stopped" | "running";

const SERVICE_ROWS: { key: ServiceKey; label: string }[] = [
  { key: "worker", label: "Worker Service" },
  { key: "discovery", label: "Discovery Service" },
];

export function AdminPage() {
  const baseId = useId();
  const [serviceStatus, setServiceStatus] = useState<Record<ServiceKey, ServiceState>>({
    worker: "stopped",
    discovery: "stopped",
  });
  const [ingestUrl, setIngestUrl] = useState("");
  const [incidentsFile, setIncidentsFile] = useState<File | null>(null);
  const [reportsFile, setReportsFile] = useState<File | null>(null);
  const [dryRun, setDryRun] = useState(false);
  const [backupFile, setBackupFile] = useState<File | null>(null);
  const [resetConfirm, setResetConfirm] = useState("");

  useEffect(() => {
    setDocumentPageTitle("Admin");
  }, []);

  const fid = (name: string) => `${baseId}-${name}`;

  const stub = useCallback((action: string) => {
    toast.info(`${action} is not connected to the API yet.`, {
      autoClose: 3200,
    });
  }, []);

  const handleStart = (key: ServiceKey) => {
    setServiceStatus((s) => ({ ...s, [key]: "running" }));
    stub(`Start ${key === "worker" ? "Worker" : "Discovery"} service`);
  };

  const handleStop = (key: ServiceKey) => {
    setServiceStatus((s) => ({ ...s, [key]: "stopped" }));
    stub(`Stop ${key === "worker" ? "Worker" : "Discovery"} service`);
  };

  const handleEnqueue = () => {
    if (!ingestUrl.trim()) {
      toast.error("Enter a URL to enqueue.", { autoClose: 2500 });
      return;
    }
    stub("Enqueue URL");
  };

  const handleAiidImport = () => {
    if (!incidentsFile && !reportsFile) {
      toast.error("Select at least one CSV file.", { autoClose: 2500 });
      return;
    }
    stub(
      dryRun
        ? "AIID import (dry run)"
        : "AIID import",
    );
  };

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
      <header className="adminPage__header">
        <div>
          <PageHeading className="adminPage__title">Admin</PageHeading>
          <p className="adminPage__subtitle">
            System controls, ingestion, and data management
          </p>
        </div>
      </header>

      <section className="adminPage__card" aria-labelledby={fid("services-title")}>
        <div className="adminPage__cardHead">
          <span className="adminPage__cardIconWrap" aria-hidden>
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
            const status = serviceStatus[row.key];
            const running = status === "running";
            return (
              <li key={row.key} className="adminPage__serviceRow">
                <span className="adminPage__serviceName">{row.label}</span>
                <span
                  role="status"
                  className={`adminPage__statusPill${running ? " adminPage__statusPill--running" : " adminPage__statusPill--stopped"}`}
                >
                  <span className="adminPage__statusPillDot" aria-hidden />
                  {running ? "Running" : "Stopped"}
                </span>
                <div className="adminPage__serviceActions">
                  <button
                    type="button"
                    className="usersPage__btn usersPage__btn--primary usersPage__btn--inviteSend"
                    onClick={() => handleStart(row.key)}
                    disabled={running}
                  >
                    <Play size={16} strokeWidth={2} aria-hidden />
                    Start
                  </button>
                  <button
                    type="button"
                    className="usersPage__btn usersPage__btn--logoutTone"
                    onClick={() => handleStop(row.key)}
                    disabled={!running}
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

      <div className="adminPage__split">
        <section className="adminPage__card" aria-labelledby={fid("ingest-title")}>
          <div className="adminPage__cardHead">
            <span className="adminPage__cardIconWrap" aria-hidden>
              <Link2 size={20} strokeWidth={2} />
            </span>
            <div className="adminPage__cardHeadText">
              <h2 id={fid("ingest-title")} className="adminPage__cardTitle">
                URL ingestion
              </h2>
              <p className="adminPage__cardHint">
                Manually queue a URL for risk extraction.
              </p>
            </div>
          </div>
          <div className="adminPage__ingestRow">
            <input
              id={fid("ingest-url")}
              type="url"
              className="adminPage__input"
              placeholder="https://example.com/article"
              value={ingestUrl}
              onChange={(e) => setIngestUrl(e.target.value)}
              autoComplete="off"
            />
            <button
              type="button"
              className="usersPage__inviteBtn"
              onClick={handleEnqueue}
            >
              <Play size={18} strokeWidth={2} aria-hidden />
              Enqueue
            </button>
          </div>
        </section>

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
      </div>

      <section className="adminPage__card" aria-labelledby={fid("data-title")}>
        <div className="adminPage__cardHead">
          <span className="adminPage__cardIconWrap" aria-hidden>
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
    </main>
  );
}
