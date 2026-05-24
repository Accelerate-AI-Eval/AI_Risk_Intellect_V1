const DEFAULT_PYTHON_URL = "http://localhost:5006";

function pythonBaseUrl(): string {
  return (
    process.env.PYTHON_INGEST_URL?.trim() || DEFAULT_PYTHON_URL
  ).replace(/\/$/, "");
}

/** Ensure Python HTTP service is up before processing jobs. */
export async function assertPythonServiceReady(): Promise<void> {
  const base = pythonBaseUrl();
  let res: Response;
  try {
    res = await fetch(`${base}/health`, {
      method: "GET",
      signal: AbortSignal.timeout(8_000),
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Python unreachable at ${base}/health — ${msg}`);
  }
  if (!res.ok) {
    throw new Error(`Python health check failed (HTTP ${res.status}) at ${base}/health`);
  }
}
