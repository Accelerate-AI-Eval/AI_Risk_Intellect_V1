import path from "node:path";
import { db } from "../../db/index.js";
import { aiidReports } from "../../schema/aiid/reports.js";
import { pythonEtlImport } from "../../etl/pythonBridge.js";
import {
  ETL_INSERT_BATCH_SIZE,
  ETL_ALLOWED_EXTENSIONS,
  ETL_MAX_FILE_BYTES,
  type EtlImportSummary,
  type ParsedEtlRecord,
} from "../../etl/etlImport.types.js";
import { HttpError } from "../../utils/httpError.js";
import {
  formatDbError,
  mapRecordToRow,
} from "./etlRowSanitize.js";
import {
  completeReportUpload,
  createReportUpload,
  failReportUpload,
  findPriorUploadWithSameFile,
  updateReportUploadProgress,
} from "./etlReportUploads.service.js";
import {
  getReportUploadDisplayName,
  hashReportUploadBuffer,
  persistReportUploadFile,
  readReportUploadFile,
} from "./etlReportFileStorage.js";

export { mapRecordToRow } from "./etlRowSanitize.js";

export function validateEtlUploadFile(
  file: Express.Multer.File | undefined,
): Express.Multer.File {
  if (!file) {
    throw HttpError.badRequest("No file uploaded. Expected form field 'file'.");
  }

  if (!file.buffer?.length) {
    throw HttpError.badRequest("Uploaded file is empty.");
  }

  if (file.size > ETL_MAX_FILE_BYTES) {
    throw HttpError.badRequest(
      `File exceeds maximum size of ${ETL_MAX_FILE_BYTES} bytes.`,
    );
  }

  const ext = path.extname(file.originalname).toLowerCase();
  if (!ETL_ALLOWED_EXTENSIONS.includes(ext as (typeof ETL_ALLOWED_EXTENSIONS)[number])) {
    throw HttpError.badRequest(
      `Unsupported file type ${ext || "(none)"}. Allowed: ${ETL_ALLOWED_EXTENSIONS.join(", ")}`,
    );
  }

  return file;
}

function safeMapRecordToRow(record: ParsedEtlRecord) {
  try {
    return mapRecordToRow(record);
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    throw new Error(`Invalid row ${record.id}: ${message}`);
  }
}

export function findDuplicateUrlsInFile(urls: string[]): string[] {
  const counts = new Map<string, number>();
  const duplicates: string[] = [];

  for (const url of urls) {
    const nextCount = (counts.get(url) ?? 0) + 1;
    counts.set(url, nextCount);
    if (nextCount === 2) duplicates.push(url);
  }

  return duplicates;
}

export function dedupeRecordsByUrlInFile(records: ParsedEtlRecord[]): {
  records: ParsedEtlRecord[];
  skippedRows: number;
} {
  const seenUrls = new Set<string>();
  const kept: ParsedEtlRecord[] = [];
  let skippedRows = 0;

  for (const record of records) {
    const url = safeMapRecordToRow(record).url;
    if (seenUrls.has(url)) {
      skippedRows += 1;
      console.info("[etl-import] skipped duplicate url in file", {
        table: "aiid_reports",
        objectId: record.id,
        url,
      });
      continue;
    }

    seenUrls.add(url);
    kept.push(record);
  }

  return { records: kept, skippedRows };
}

const DUPLICATE_FILE_MESSAGE =
  "This file was already uploaded. All report URLs from this file are already in the system.";

export async function bulkInsertReportRecords(
  records: ParsedEtlRecord[],
  uploadId: number,
  batchSize = ETL_INSERT_BATCH_SIZE,
): Promise<{ importedRows: number; skippedRows: number; failedRows: number }> {
  let importedRows = 0;
  let skippedRows = 0;
  let failedRows = 0;

  for (let offset = 0; offset < records.length; offset += batchSize) {
    const batch = records
      .slice(offset, offset + batchSize)
      .map((record) => ({ ...safeMapRecordToRow(record), uploadId }));

    try {
      const inserted = await db
        .insert(aiidReports)
        .values(batch)
        .onConflictDoNothing({ target: aiidReports.url })
        .returning({ id: aiidReports.id });

      importedRows += inserted.length;
      skippedRows += batch.length - inserted.length;
    } catch (err) {
      console.error(
        "[etl-import] batch insert failed, falling back to row-by-row:",
        formatDbError(err),
      );

      for (const row of batch) {
        try {
          const [inserted] = await db
            .insert(aiidReports)
            .values(row)
            .onConflictDoNothing({ target: aiidReports.url })
            .returning({ id: aiidReports.id });

          if (inserted) importedRows += 1;
          else skippedRows += 1;
        } catch (rowErr) {
          failedRows += 1;
          console.error("[etl-import] row insert failed", {
            objectId: row.objectId,
            error: formatDbError(rowErr),
          });
        }
      }
    }
  }

  return { importedRows, skippedRows, failedRows };
}

export async function importReportsFile(
  file: Express.Multer.File,
  options?: { suggestedName?: string },
): Promise<EtlImportSummary & { uploadId: number }> {
  const validated = validateEtlUploadFile(file);
  const fileSha256 = hashReportUploadBuffer(validated.buffer);

  const priorUpload = await findPriorUploadWithSameFile(fileSha256);
  if (priorUpload?.status === "completed") {
    throw HttpError.conflict(DUPLICATE_FILE_MESSAGE);
  }

  const reportFilePath = await persistReportUploadFile(
    validated.buffer,
    validated.originalname,
  );
  const upload = await createReportUpload({
    suggestedName: options?.suggestedName,
    reportFilePath,
    fileSha256,
  });

  try {
    const storedBuffer = await readReportUploadFile(reportFilePath);
    const parsed = await pythonEtlImport(storedBuffer, {
      filename: getReportUploadDisplayName(reportFilePath),
    });

    await updateReportUploadProgress(upload.id, {
      totalRows: parsed.totalRows,
    });

    if (parsed.skippedDetails?.length) {
      for (const detail of parsed.skippedDetails) {
        console.info("[etl-import] skipped row", { table: "aiid_reports", ...detail });
      }
    }

    if (parsed.failedDetails?.length) {
      for (const detail of parsed.failedDetails) {
        console.warn("[etl-import] failed row", { table: "aiid_reports", ...detail });
      }
    }

    const { records: uniqueRecords, skippedRows: duplicateInFileSkipped } =
      dedupeRecordsByUrlInFile(parsed.records);

    const insertResult = await bulkInsertReportRecords(uniqueRecords, upload.id);

    const summary: EtlImportSummary = {
      totalRows: parsed.totalRows,
      importedRows: insertResult.importedRows,
      skippedRows:
        parsed.skippedRows +
        duplicateInFileSkipped +
        insertResult.skippedRows,
      failedRows: parsed.failedRows + insertResult.failedRows,
    };

    await completeReportUpload(upload.id, summary);

    return { ...summary, uploadId: upload.id };
  } catch (err) {
    const message =
      err instanceof HttpError
        ? err.message
        : err instanceof Error
          ? err.message
          : "Report import failed.";

    await failReportUpload(upload.id, message);
    throw err;
  }
}
