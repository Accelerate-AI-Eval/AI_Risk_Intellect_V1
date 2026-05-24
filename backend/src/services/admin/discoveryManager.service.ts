import type { ChildProcess } from "node:child_process";
import { workerState } from "../../workers/state.js";
import {
  killChildProcess,
  spawnBackendScript,
} from "./spawnBackendScript.js";
import { getWorkerStatus } from "./workerManager.service.js";

function isRunning(): boolean {
  return (
    workerState.discoveryEnabled &&
    workerState.discoveryChild != null &&
    workerState.discoveryChild.exitCode == null &&
    !workerState.discoveryChild.killed
  );
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

export function startDiscoveryProcess(): { pid: number } {
  if (isRunning()) {
    return { pid: workerState.discoveryChild!.pid! };
  }

  const child = spawnBackendScript("src/workers/discoveryService.ts");

  workerState.discoveryChild = child;
  workerState.discoveryEnabled = true;

  child.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });

  child.on("error", (err) => {
    console.error("[discovery-manager] child process error:", err);
    workerState.discoveryEnabled = false;
    workerState.discoveryChild = null;
  });

  child.on("exit", () => {
    workerState.discoveryEnabled = false;
    workerState.discoveryChild = null;
    workerState.discoveryStop = null;
  });

  if (!child.pid) {
    throw new Error("Failed to start discovery process (no PID).");
  }

  return { pid: child.pid };
}

export function stopDiscoveryProcess(): void {
  const child = workerState.discoveryChild;
  if (!child || child.killed) {
    workerState.discoveryEnabled = false;
    workerState.discoveryChild = null;
    return;
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
