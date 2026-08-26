import { authFetch } from "./authFetch";

export type BatchRunItemProcessingStatus =
  | "pending"
  | "running"
  | "done"
  | "failed";

export type BatchRunCounts = {
  total: number;
  pending: number;
  running: number;
  done: number;
  failed: number;
};

export type BatchRunItem = {
  id: number;
  sourceType: "rss" | "etl";
  ingestLinkId: number | null;
  ingestLinkItemId: number | null;
  feedName: string | null;
  uploadId: number | null;
  reportId: number | null;
  url: string;
  title: string | null;
  status: string;
  processingStatus?: BatchRunItemProcessingStatus;
  errorMessage: string | null;
  createdAt: string;
};

export type BatchRun = {
  id: number;
  modelName: string;
  modelLabel: string | null;
  status: string;
  rssItemCount: number;
  etlItemCount: number;
  errorMessage: string | null;
  createdAt: string;
  startedAt: string | null;
  completedAt: string | null;
  counts?: BatchRunCounts;
  items?: BatchRunItem[];
};

type ApiErrorBody = {
  error?: { message?: string };
  message?: string;
};

function errorMessage(data: ApiErrorBody, fallback: string): string {
  return data.error?.message ?? data.message ?? fallback;
}

export async function startBatchRun(selection: {
  modelId?: string;
  ingestLinkIds?: number[];
  ingestLinkItemIds?: number[];
  uploadIds?: number[];
  reportIds?: number[];
}): Promise<
  | { ok: true; message: string; batch: BatchRun }
  | { ok: false; message: string }
> {
  try {
    const res = await authFetch("/admin/batch-runs/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selection),
    });
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody & {
      message?: string;
      batch?: BatchRun;
    };
    if (!res.ok || !data.batch) {
      return {
        ok: false,
        message: errorMessage(data, "Could not start batch run."),
      };
    }
    return {
      ok: true,
      message: data.message ?? "Batch started.",
      batch: data.batch,
    };
  } catch {
    return { ok: false, message: "Network error while starting batch run." };
  }
}

export async function fetchBatchRuns(
  limit = 25,
): Promise<
  | { ok: true; batches: BatchRun[] }
  | { ok: false; message: string }
> {
  try {
    const res = await authFetch(
      `/admin/batch-runs?limit=${encodeURIComponent(String(limit))}`,
    );
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody & {
      batches?: BatchRun[];
    };
    if (!res.ok) {
      return {
        ok: false,
        message: errorMessage(data, "Could not load batch runs."),
      };
    }
    return { ok: true, batches: data.batches ?? [] };
  } catch {
    return { ok: false, message: "Network error while loading batch runs." };
  }
}

export async function fetchBatchRun(
  id: number,
): Promise<
  | { ok: true; batch: BatchRun }
  | { ok: false; message: string }
> {
  try {
    const res = await authFetch(`/admin/batch-runs/${id}`);
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody & {
      batch?: BatchRun;
    };
    if (!res.ok || !data.batch) {
      return {
        ok: false,
        message: errorMessage(data, "Could not load batch run."),
      };
    }
    return { ok: true, batch: data.batch };
  } catch {
    return { ok: false, message: "Network error while loading batch run." };
  }
}

export async function deleteBatchRun(
  id: number,
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  try {
    const res = await authFetch(`/admin/batch-runs/${id}`, {
      method: "DELETE",
    });
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody & {
      message?: string;
    };
    if (!res.ok) {
      return {
        ok: false,
        message: errorMessage(data, "Could not delete batch run."),
      };
    }
    return {
      ok: true,
      message: data.message ?? "Batch deleted.",
    };
  } catch {
    return { ok: false, message: "Network error while deleting batch run." };
  }
}
