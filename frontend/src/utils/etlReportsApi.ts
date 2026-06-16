import { authFetch } from "./authFetch";

export type EtlReportUploadItemExtractionStatus =
  | "imported"
  | "skipped_existing"
  | "skipped_duplicate_in_file"
  | "skipped_invalid"
  | "failed";

export type EtlExtractionDisplayStatus =
  | "pending"
  | "processing"
  | "completed"
  | "partially_completed"
  | "skipped"
  | "failed";

export type EtlReportUploadItemRow = {
  id: number;
  uploadId: number;
  rowOrder: number;
  objectId: string | null;
  url: string;
  title: string | null;
  extractionStatus: EtlReportUploadItemExtractionStatus;
  skipReason: string | null;
};

export type EtlReportUploadRow = {
  id: number;
  suggestedName: string | null;
  reportFilePath: string;
  fileName: string;
  status: "pending" | "processing" | "completed" | "failed";
  extractionStatus: EtlExtractionDisplayStatus;
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

export async function extractEtlReportUpload(
  id: number,
): Promise<
  | {
      ok: true;
      message: string;
      totalRows?: number;
      importedRows?: number;
      skippedRows?: number;
      failedRows?: number;
    }
  | { ok: false; message: string }
> {
  try {
    const res = await authFetch(`/admin/etl/reports/uploads/${id}/extract`, {
      method: "POST",
    });
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody & {
      message?: string;
      totalRows?: number;
      importedRows?: number;
      skippedRows?: number;
      failedRows?: number;
    };

    if (!res.ok) {
      return {
        ok: false,
        message: errorMessage(data, "Could not extract report URLs."),
      };
    }

    return {
      ok: true,
      message: data.message ?? "Report URLs extracted.",
      totalRows: data.totalRows,
      importedRows: data.importedRows,
      skippedRows: data.skippedRows,
      failedRows: data.failedRows,
    };
  } catch {
    return {
      ok: false,
      message: "Network error while extracting report URLs.",
    };
  }
}

export async function reuploadEtlReportUpload(
  id: number,
  file: File,
  suggestedName = "",
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  const formData = new FormData();
  formData.append("file", file);
  const trimmedName = suggestedName.trim();
  if (trimmedName) formData.append("suggestedName", trimmedName);

  try {
    const res = await authFetch(`/admin/etl/reports/uploads/${id}/reupload`, {
      method: "POST",
      body: formData,
    });
    const data = (await res.json().catch(() => ({}))) as ApiErrorBody & {
      message?: string;
    };

    if (!res.ok) {
      return {
        ok: false,
        message: errorMessage(data, "Could not reupload report file."),
      };
    }

    return {
      ok: true,
      message: data.message ?? "Report file replaced.",
    };
  } catch {
    return {
      ok: false,
      message: "Network error while reuploading report file.",
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
