import { authFetch } from "./authFetch";

export type EtlReportUploadItemRow = {
  id: number;
  uploadId: number;
  rowOrder: number;
  objectId: string | null;
  url: string;
  title: string | null;
};

export type EtlReportUploadRow = {
  id: number;
  suggestedName: string | null;
  reportFilePath: string;
  fileName: string;
  status: "processing" | "completed" | "failed";
  totalRows: number;
  importedRows: number;
  skippedRows: number;
  failedRows: number;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
};

type ApiErrorBody = {
  error?: { message?: string };
  message?: string;
};

function errorMessage(data: ApiErrorBody, fallback: string): string {
  return data.error?.message ?? data.message ?? fallback;
}

export async function fetchEtlReportUploads(): Promise<
  | { ok: true; uploads: EtlReportUploadRow[] }
  | { ok: false; message: string }
> {
  try {
    const res = await authFetch("/admin/etl/reports/uploads");
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody & {
      uploads?: EtlReportUploadRow[];
    };

    if (!res.ok) {
      return {
        ok: false,
        message: errorMessage(data, "Could not load report uploads."),
      };
    }

    return { ok: true, uploads: data.uploads ?? [] };
  } catch {
    return {
      ok: false,
      message: "Network error while loading report uploads.",
    };
  }
}

export async function fetchEtlReportUploadItems(
  uploadId: number,
): Promise<
  | { ok: true; items: EtlReportUploadItemRow[] }
  | { ok: false; message: string }
> {
  try {
    const res = await authFetch(`/admin/etl/reports/uploads/${uploadId}/items`);
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody & {
      items?: EtlReportUploadItemRow[];
    };

    if (!res.ok) {
      return {
        ok: false,
        message: errorMessage(data, "Could not load report URLs."),
      };
    }

    return { ok: true, items: data.items ?? [] };
  } catch {
    return {
      ok: false,
      message: "Network error while loading report URLs.",
    };
  }
}

export async function startEtlReportsRun(
  selection: { uploadIds: number[]; reportIds: number[] },
): Promise<
  | {
      ok: true;
      message: string;
      enqueued?: number;
      selectedReportCount?: number;
    }
  | { ok: false; message: string }
> {
  try {
    const res = await authFetch("/admin/etl/reports/start", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(selection),
    });
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody & {
      message?: string;
      enqueued?: number;
      selectedReportCount?: number;
    };

    if (!res.ok) {
      return {
        ok: false,
        message: errorMessage(data, "Could not start reports worker."),
      };
    }

    return {
      ok: true,
      message: data.message ?? "Reports worker started.",
      enqueued: data.enqueued,
      selectedReportCount: data.selectedReportCount,
    };
  } catch {
    return {
      ok: false,
      message: "Network error while starting reports worker.",
    };
  }
}

export async function archiveEtlReportUpload(
  id: number,
): Promise<{ ok: true } | { ok: false; message: string }> {
  try {
    const res = await authFetch(`/admin/etl/reports/uploads/${id}/archive`, {
      method: "POST",
    });
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody;

    if (!res.ok) {
      return {
        ok: false,
        message: errorMessage(data, "Could not archive report upload."),
      };
    }

    return { ok: true };
  } catch {
    return {
      ok: false,
      message: "Network error while archiving report upload.",
    };
  }
}
