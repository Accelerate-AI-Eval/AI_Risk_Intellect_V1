import { authFetch } from "../../../../utils/authFetch";

const REPORTS_UPLOAD_PATH = "/admin/etl/reports/upload";

const ALLOWED_EXTENSIONS = [".csv", ".xlsx", ".xls"];

function isAllowedEtlFile(fileName: string): boolean {
  const lower = fileName.toLowerCase();
  return ALLOWED_EXTENSIONS.some((ext) => lower.endsWith(ext));
}

function formatImportSummary(data: {
  message?: string;
  totalRows?: number;
  importedRows?: number;
  skippedRows?: number;
  failedRows?: number;
}): string {
  if (typeof data.totalRows === "number") {
    return `Imported ${data.importedRows ?? 0} of ${data.totalRows} rows (${data.skippedRows ?? 0} skipped, ${data.failedRows ?? 0} failed).`;
  }
  return data.message ?? "Reports file uploaded successfully.";
}

export async function uploadEtlReports(
  file: File,
  suggestedName = "",
): Promise<{ ok: true; message: string } | { ok: false; message: string }> {
  if (!isAllowedEtlFile(file.name)) {
    return {
      ok: false,
      message: "Please select a CSV or Excel file (.csv, .xlsx, .xls).",
    };
  }

  const formData = new FormData();
  formData.append("file", file);
  const trimmedName = suggestedName.trim();
  if (trimmedName) formData.append("suggestedName", trimmedName);

  try {
    const res = await authFetch(REPORTS_UPLOAD_PATH, {
      method: "POST",
      body: formData,
    });
    const data = (await res.json().catch(() => ({}))) as {
      message?: string;
      totalRows?: number;
      importedRows?: number;
      skippedRows?: number;
      failedRows?: number;
      error?: { message?: string };
    };

    if (!res.ok) {
      return {
        ok: false,
        message:
          data.error?.message ??
          (res.status === 404
            ? "Upload API is not connected yet."
            : "Could not upload file."),
      };
    }

    return {
      ok: true,
      message: formatImportSummary(data),
    };
  } catch {
    return {
      ok: false,
      message: "Network error while uploading file.",
    };
  }
}
