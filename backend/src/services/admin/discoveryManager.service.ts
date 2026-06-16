import type { ChildProcess } from "node:child_process";
import {
  msUntilNextCronScheduleRun,
  type CronScheduleConfig,
} from "../../config/cronScheduleConfig.js";
import { createLogger } from "../../logger/index.js";
import { CRON_LOOP_PLANNED_EXIT_CODE } from "../../workers/rssDiscovery.js";
import { workerState } from "../../workers/state.js";
import {
  killChildProcess,
  spawnBackendScript,
} from "./spawnBackendScript.js";
import { ensureWorkerProcessRunning, getWorkerStatus } from "./workerManager.service.js";
import { recordCronJobEvent } from "./cronJobEvents.service.js";
import {
  loadActiveCronScheduleConfig,
  loadActiveCronScheduleId,
} from "./cronSchedule.service.js";

const discoveryManagerLog = createLogger("discovery-manager");

/** Start the loop process this long before the scheduled run so it can sleep until start time. */
const CRON_START_WINDOW_MS = 2 * 60_000;

let suppressExitCronStopNotification = false;
let scheduleNextCronRunPending = false;
let cronLoopRestartTimer: ReturnType<typeof setTimeout> | null = null;

export function clearCronLoopRestartTimer(): void {
  if (cronLoopRestartTimer) {
    clearTimeout(cronLoopRestartTimer);
    cronLoopRestartTimer = null;
  }
}

export function scheduleNextCronDiscoveryRun(
  schedule: CronScheduleConfig,
): void {
  clearCronLoopRestartTimer();

  const delayMs = msUntilNextCronScheduleRun(schedule);
  if (delayMs == null) {
    discoveryManagerLog.info("No upcoming cron discovery run", {
      scheduleId: schedule.id,
    });
    return;
  }

  if (delayMs <= CRON_START_WINDOW_MS) {
    if (!isRunning()) {
      startDiscoveryLoopProcess({ recordStartedEvent: false });
      ensureWorkerProcessRunning();
      discoveryManagerLog.info("Starting discovery for imminent cron run", {
        scheduleId: schedule.id,
        delayMs,
      });
    }
    return;
  }

  const waitMs = Math.max(1_000, delayMs - CRON_START_WINDOW_MS);
  discoveryManagerLog.info("Scheduled next cron discovery run", {
    scheduleId: schedule.id,
    waitMs,
    nextRunInMs: delayMs,
  });

  cronLoopRestartTimer = setTimeout(() => {
    cronLoopRestartTimer = null;
    void loadActiveCronScheduleConfig()
      .then((active) => {
        if (!active?.active || active.ingestLinkIds.length === 0) return;
        if (isRunning()) return;
        startDiscoveryLoopProcess({ recordStartedEvent: false });
        ensureWorkerProcessRunning();
      })
      .catch((err) => {
        discoveryManagerLog.error("Failed to start scheduled cron discovery", {
          err,
        });
      });
  }, waitMs);
}

function handleDiscoveryLoopExit(
  wasLoopMode: boolean,
  suppressedNotification: boolean,
  exitCode: number | null,
): void {
  if (!wasLoopMode || suppressedNotification || scheduleNextCronRunPending) {
    return;
  }

  scheduleNextCronRunPending = true;
  void loadActiveCronScheduleConfig()
    .then((schedule) => {
      if (!schedule?.active || schedule.ingestLinkIds.length === 0) return;
      scheduleNextCronDiscoveryRun(schedule);
      if (exitCode === CRON_LOOP_PLANNED_EXIT_CODE) {
        discoveryManagerLog.info(
          "Cron discovery finished scheduled run; waiting until next occurrence",
          { scheduleId: schedule.id },
        );
      }
    })
    .catch((err) => {
      discoveryManagerLog.error("Failed to schedule next cron discovery run", {
        err,
      });
    })
    .finally(() => {
      scheduleNextCronRunPending = false;
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
    handleDiscoveryLoopExit(wasLoopMode, false, null);
  });

  child.on("exit", (code) => {
    const wasLoopMode = workerState.discoveryRunMode === "loop";
    const suppressed = suppressExitCronStopNotification;
    const plannedCronExit =
      wasLoopMode && code === CRON_LOOP_PLANNED_EXIT_CODE;

    if (wasLoopMode && !suppressed && !plannedCronExit) {
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

    handleDiscoveryLoopExit(wasLoopMode, suppressed, code);
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

export function startDiscoveryLoopProcess(options?: {
  recordStartedEvent?: boolean;
}): { pid: number } {
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

  if (options?.recordStartedEvent) {
    void loadActiveCronScheduleId().then((scheduleId) =>
      recordCronJobEvent(
        scheduleId,
        "started",
        "RSS feed discovery cron job started.",
      ),
    );
  }

  return { pid: child.pid };
}

/** Stop the cron loop child (if any) and reschedule the next run at the configured time. */
export function restartDiscoveryLoopProcess(): { pid: number | null } {
  clearCronLoopRestartTimer();

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

  void loadActiveCronScheduleConfig()
    .then((schedule) => {
      if (!schedule?.active || schedule.ingestLinkIds.length === 0) return;
      scheduleNextCronDiscoveryRun(schedule);
    })
    .catch((err) => {
      discoveryManagerLog.error("Failed to reschedule cron discovery", { err });
    });

  return { pid: getDiscoveryStatus().pid };
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
  clearCronLoopRestartTimer();

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
