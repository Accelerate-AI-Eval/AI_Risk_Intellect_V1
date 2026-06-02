import { authFetch } from "../../../utils/authFetch";

export type ServiceKey = "worker" | "discovery";
export type ApiServiceState = "stopped" | "running";
export type ServiceState = ApiServiceState | "starting" | "stopping";
export type PendingAction = "starting" | "stopping";

export const DEFAULT_API_STATUS: Record<ServiceKey, ApiServiceState> = {
  worker: "stopped",
  discovery: "stopped",
};

export function serviceStatusLabel(status: ServiceState): string {
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

export function serviceStatusPillClass(status: ServiceState): string {
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

export function isServiceBusy(status: ServiceState): boolean {
  return status === "starting" || status === "stopping";
}

export function displayServiceStatus(
  key: ServiceKey,
  apiStatus: Record<ServiceKey, ApiServiceState>,
  pending: Partial<Record<ServiceKey, PendingAction>>,
): ServiceState {
  return pending[key] ?? apiStatus[key];
}

export async function readServiceApiStatus(): Promise<Record<
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

export async function waitForServiceApiState(
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
