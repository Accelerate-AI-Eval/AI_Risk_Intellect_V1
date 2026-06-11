import type { ChildProcess } from "node:child_process";
import { createLogger } from "../../logger/index.js";
import { workerState } from "../../workers/state.js";
import {
  killChildProcess,
  spawnBackendScript,
} from "./spawnBackendScript.js";
import { getWorkerStatus } from "./workerManager.service.js";
import { recordCronJobEvent } from "./cronJobEvents.service.js";
import {
  loadActiveCronScheduleConfig,
  loadActiveCronScheduleId,
} from "./cronSchedule.service.js";

const discoveryManagerLog = createLogger("discovery-manager");

let suppressExitCronStopNotification = false;
let restartDiscoveryLoopPending = false;

function maybeRestartDiscoveryLoopAfterExit(
  wasLoopMode: boolean,
  suppressedNotification: boolean,
): void {
  if (!wasLoopMode || suppressedNotification || restartDiscoveryLoopPending) {
    return;
  }

  restartDiscoveryLoopPending = true;
  void loadActiveCronScheduleConfig()
    .then((schedule) => {
      if (!schedule?.active || schedule.ingestLinkIds.length === 0) return;
      if (isRunning()) return;
      startDiscoveryLoopProcess();
      discoveryManagerLog.info("Restarted discovery loop for active cron schedule", {
        scheduleId: schedule.id,
      });
    })
    .catch((err) => {
      discoveryManagerLog.error("Failed to restart discovery loop", { err });
    })
    .finally(() => {
      restartDiscoveryLoopPending = false;
    });
}

function isRunning(): boolean {
  return (
    workerState.discoveryEnabled &&
    workerState.discoveryChild != null &&
    workerState.discoveryChild.exitCode == null &&
    !workerState.discoveryChild.killed
  );
}

function attachDiscoveryChildHandlers(child: ChildProcess): void {
  child.stdout?.on("data", (chunk: Buffer) => {
    const text = chunk.toString().trimEnd();
    if (text) discoveryManagerLog.info(text);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    const text = chunk.toString().trimEnd();
    if (text) discoveryManagerLog.warn(text);
  });

  child.on("error", (err) => {
    discoveryManagerLog.error("Child process error", { err });
    const wasLoopMode = workerState.discoveryRunMode === "loop";
    workerState.discoveryEnabled = false;
    workerState.discoveryRunMode = null;
    workerState.discoveryChild = null;
    maybeRestartDiscoveryLoopAfterExit(wasLoopMode, false);
  });

  child.on("exit", () => {
    const wasLoopMode = workerState.discoveryRunMode === "loop";
    const suppressed = suppressExitCronStopNotification;

    if (wasLoopMode && !suppressed) {
      void loadActiveCronScheduleId().then((scheduleId) =>
        recordCronJobEvent(
          scheduleId,
          "stopped",
          "RSS feed discovery cron job stopped unexpectedly.",
        ),
      );
    }

    suppressExitCronStopNotification = false;
    workerState.discoveryEnabled = false;
    workerState.discoveryRunMode = null;
    workerState.discoveryChild = null;
    workerState.discoveryStop = null;

    maybeRestartDiscoveryLoopAfterExit(wasLoopMode, suppressed);
  });
}

export function getDiscoveryStatus(): {
  running: boolean;
  pid: number | null;
} {
  const child = workerState.discoveryChild;
  return {
    running: isRunning(),
    pid: child?.pid ?? null,
  };
}

export function startDiscoveryLoopProcess(): { pid: number } {
  if (isRunning()) {
    return { pid: workerState.discoveryChild!.pid! };
  }

  const child = spawnBackendScript("src/workers/discoveryService.ts", {
    env: {
      RUN_ONCE: "false",
    },
  });

  workerState.discoveryChild = child;
  workerState.discoveryEnabled = true;
  workerState.discoveryRunMode = "loop";

  attachDiscoveryChildHandlers(child);

  if (!child.pid) {
    workerState.discoveryRunMode = null;
    throw new Error("Failed to start discovery process (no PID).");
  }

  void loadActiveCronScheduleId().then((scheduleId) =>
    recordCronJobEvent(
      scheduleId,
      "started",
      "RSS feed discovery cron job started.",
    ),
  );

  return { pid: child.pid };
}

/** Stop the cron loop child (if any) and start fresh so the first cycle runs immediately. */
export function restartDiscoveryLoopProcess(): { pid: number } {
  if (isRunning()) {
    suppressExitCronStopNotification = true;
    const child = workerState.discoveryChild;
    workerState.discoveryStop?.abort();
    workerState.discoveryEnabled = false;
    workerState.discoveryRunMode = null;
    workerState.discoveryChild = null;
    workerState.discoveryStop = null;
    if (child && !child.killed && child.pid) {
      killChildProcess(child);
    }
  }

  return startDiscoveryLoopProcess();
}

export function startDiscoveryProcess(options: {
  ingestLinkIds?: number[];
  ingestLinkItemIds?: number[];
}): { pid: number } {
  if (isRunning()) {
    return { pid: workerState.discoveryChild!.pid! };
  }

  const ingestLinkIds = options.ingestLinkIds ?? [];
  const ingestLinkItemIds = options.ingestLinkItemIds ?? [];

  const child = spawnBackendScript("src/workers/discoveryService.ts", {
    env: {
      DISCOVERY_INGEST_LINK_IDS: ingestLinkIds.join(","),
      DISCOVERY_INGEST_LINK_ITEM_IDS: ingestLinkItemIds.join(","),
      RUN_ONCE: "true",
    },
  });

  workerState.discoveryChild = child;
  workerState.discoveryEnabled = true;
  workerState.discoveryRunMode = "once";

  attachDiscoveryChildHandlers(child);

  if (!child.pid) {
    workerState.discoveryRunMode = null;
    throw new Error("Failed to start discovery process (no PID).");
  }

  return { pid: child.pid };
}

export function stopDiscoveryProcess(): void {
  const child = workerState.discoveryChild;
  if (!child || child.killed) {
    workerState.discoveryEnabled = false;
    workerState.discoveryRunMode = null;
    workerState.discoveryChild = null;
    return;
  }

  if (workerState.discoveryRunMode === "loop") {
    suppressExitCronStopNotification = true;
    void loadActiveCronScheduleId().then((scheduleId) =>
      recordCronJobEvent(
        scheduleId,
        "stopped",
        "RSS feed discovery cron job stopped.",
      ),
    );
  }

  workerState.discoveryStop?.abort();
  killChildProcess(child);
}

export function getServicesStatus(): Record<string, { running: boolean; pid: number | null }> {
  return {
    worker: getWorkerStatus(),
    discovery: getDiscoveryStatus(),
  };
}
