import type { ChildProcess } from "node:child_process";
import { workerState } from "../../workers/state.js";
import {
  killChildProcess,
  spawnBackendScript,
} from "./spawnBackendScript.js";

function isRunning(): boolean {
  return (
    workerState.jobWorkerEnabled &&
    workerState.jobWorkerChild != null &&
    workerState.jobWorkerChild.exitCode == null &&
    !workerState.jobWorkerChild.killed
  );
}

export function getWorkerStatus(): {
  running: boolean;
  pid: number | null;
} {
  const child = workerState.jobWorkerChild;
  return {
    running: isRunning(),
    pid: child?.pid ?? null,
  };
}

export function startWorkerProcess(): { pid: number } {
  if (isRunning()) {
    return { pid: workerState.jobWorkerChild!.pid! };
  }

  const child = spawnBackendScript("src/workers/jobWorker.ts");

  workerState.jobWorkerChild = child;
  workerState.jobWorkerEnabled = true;

  child.stdout?.on("data", (chunk: Buffer) => {
    process.stdout.write(chunk);
  });
  child.stderr?.on("data", (chunk: Buffer) => {
    process.stderr.write(chunk);
  });

  child.on("error", (err) => {
    console.error("[worker-manager] child process error:", err);
    workerState.jobWorkerEnabled = false;
    workerState.jobWorkerChild = null;
  });

  child.on("exit", () => {
    workerState.jobWorkerEnabled = false;
    workerState.jobWorkerChild = null;
    workerState.jobWorkerStop = null;
  });

  if (!child.pid) {
    throw new Error("Failed to start worker process (no PID).");
  }

  return { pid: child.pid };
}

export function stopWorkerProcess(): void {
  const child = workerState.jobWorkerChild;
  if (!child || child.killed) {
    workerState.jobWorkerEnabled = false;
    workerState.jobWorkerChild = null;
    return;
  }

  workerState.jobWorkerStop?.abort();
  killChildProcess(child);
}
