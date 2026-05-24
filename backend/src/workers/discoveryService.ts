import "../bootstrap.js";

/**
 * Port of `app/workers/discovery_service.py` — run as standalone process:
 *   npm run discovery
 *   RUN_ONCE=true npm run discovery:once
 */
import path from "node:path";
import { fileURLToPath } from "node:url";
import { autoIngestLoop } from "./rssDiscovery.js";
import { workerState } from "./state.js";

const log = {
  info: (msg: string, ...args: unknown[]) =>
    console.log(`${new Date().toISOString()} [DISCOVERY] INFO: ${msg}`, ...args),
  warn: (msg: string, ...args: unknown[]) =>
    console.warn(`${new Date().toISOString()} [DISCOVERY] WARN: ${msg}`, ...args),
  error: (msg: string, ...args: unknown[]) =>
    console.error(`${new Date().toISOString()} [DISCOVERY] ERROR: ${msg}`, ...args),
};

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.resolve(__dirname, "../..");
const cfgPath = path.join(projectRoot, "config", "sources.yaml");

let stopRequested = false;

function handleShutdown(signal: string): void {
  stopRequested = true;
  log.warn("[discovery-service] shutdown signal received (%s)", signal);
  workerState.discoveryStop?.abort();
}

process.on("SIGTERM", () => handleShutdown("SIGTERM"));
process.on("SIGINT", () => handleShutdown("SIGINT"));

async function discoveryLoop(): Promise<void> {
  const runOnce = ["1", "true", "yes"].includes(
    (process.env.RUN_ONCE ?? "false").toLowerCase(),
  );

  log.info("[discovery-service] Discovery loop starting (run_once=%s)", runOnce);

  const stopController = new AbortController();
  workerState.discoveryStop = stopController;
  workerState.discoveryEnabled = true;

  try {
    await autoIngestLoop(stopController.signal, cfgPath, { runOnce });
  } catch (err) {
    if (stopRequested || stopController.signal.aborted) {
      log.info("[discovery-service] cancelled");
    } else {
      log.error("[discovery-service] crash: %s", String(err));
    }
  } finally {
    workerState.discoveryEnabled = false;
    workerState.discoveryStop = null;
  }

  log.info("[discovery-service] exiting");
}

log.info("[discovery-service] booting");

discoveryLoop().catch((err) => {
  log.error("[discovery-service] fatal: %s", String(err));
  process.exitCode = 1;
});
