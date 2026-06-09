import { useState } from "react";
import type { ServiceState } from "../adminServices";
import { IncidentsTab } from "./incidents/IncidentsTab";
import { ReportsTab } from "./reports/ReportsTab";

type EtlSubTab = "incidents" | "reports";

const ETL_SUB_TAB_LABELS: Record<EtlSubTab, string> = {
  incidents: "ETL Incidents",
  reports: "ETL Reports",
};

interface EtlSectionProps {
  idPrefix: string;
  workerStatus: ServiceState;
  workerApiRunning: boolean;
  onReportsStart: (selection: {
    uploadIds: number[];
    reportIds: number[];
  }) => void;
  onWorkerStop: () => void;
}

export function EtlSection({
  idPrefix,
  workerStatus,
  workerApiRunning,
  onReportsStart,
  onWorkerStop,
}: EtlSectionProps) {
  const [subTab, setSubTab] = useState<EtlSubTab>("incidents");

  return (
    <div className="adminPage__rssPanel">
      <div
        className="adminPage__tabs adminPage__tabs--sub"
        role="tablist"
        aria-label="ETL data types"
      >
        {(Object.keys(ETL_SUB_TAB_LABELS) as EtlSubTab[]).map((key) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={subTab === key}
            className={`adminPage__tab${subTab === key ? " adminPage__tab--selected" : ""}`}
            onClick={() => setSubTab(key)}
          >
            {ETL_SUB_TAB_LABELS[key]}
          </button>
        ))}
      </div>

      {subTab === "incidents" && <IncidentsTab idPrefix={idPrefix} />}
      {subTab === "reports" && (
        <ReportsTab
          idPrefix={idPrefix}
          workerStatus={workerStatus}
          workerApiRunning={workerApiRunning}
          onReportsStart={onReportsStart}
          onWorkerStop={onWorkerStop}
        />
      )}
    </div>
  );
}
