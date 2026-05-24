/**
 * Port of `app/workers/job_worker.py` — poll pending jobs:
 *   pending → running → done | skipped | error
 *
 *   npm run worker
 */
import "../bootstrap.js";
import { runOneJob } from "../services/worker/jobWorker.service.js";
import { assertPythonServiceReady } from "../services/worker/pythonHealth.js";
import { workerState } from "./state.js";

const log = {
  info: (msg: string, ...args: unknown[]) =>
    console.log(`${new Date().toISOString()} [JOB-WORKER] INFO: ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`${new Date().toISOString()} [JOB-WORKER] WARN: ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`${new Date().toISOString()} [JOB-WORKER] ERROR: ${msg}`, ...args),
};

const POLL_MS = Math.max(
  500,
  Number.parseInt(process.env.JOB_POLL_MS ?? "2000", 10) || 2000,
);

let stopRequested = false;

function handleShutdown(signal: string): void {
  stopRequested = true;
  log.warn("shutdown signal received (%s)", signal);
  workerState.jobWorkerStop?.abort();
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

async function sleep(ms: number, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return;
  await new Promise<void>((resolve) => {
    const timer = setTimeout(resolve, ms);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        resolve();
      },
      { once: true },
    );
  });
}

async function workerLoop(): Promise<void> {
  const stopController = new AbortController();
  workerState.jobWorkerStop = stopController;
  workerState.jobWorkerEnabled = true;

  log.info("worker loop starting (poll_ms=%d)", POLL_MS);

  try {
    await assertPythonServiceReady();
    log.info("python ingest/extract service is reachable");
  } catch (err) {
    log.error(
      "python service not ready — start backend with npm run dev (or npm run py:dev). %s",
      String(err),
    );
  }

  try {
    while (!stopRequested && !stopController.signal.aborted) {
      const ran = await runOneJob();
      if (!ran) {
        await sleep(POLL_MS, stopController.signal);
      }
    }
  } catch (err) {
    if (stopRequested || stopController.signal.aborted) {
      log.info("cancelled");
    } else {
      log.error("crash: %s", String(err));
    }
  } finally {
    workerState.jobWorkerEnabled = false;
    workerState.jobWorkerStop = null;
  }

  log.info("exiting");
}

log.info("booting");

workerLoop().catch((err) => {
  log.error("fatal: %s", String(err));
  process.exitCode = 1;
});
