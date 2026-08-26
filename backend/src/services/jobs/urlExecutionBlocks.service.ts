import { and, eq, inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import { jobs } from "../../schema/jobs/jobs.js";
import { urlExecutionBlocks } from "../../schema/jobs/urlExecutionBlocks.js";
import { HttpError } from "../../utils/httpError.js";
import { normalizeUrl } from "../../utils/fetchUtils.js";

export const DO_NOT_EXECUTE_REASON = "Do not execute";

export async function isUrlDoNotExecute(url: string): Promise<boolean> {
  let normalized: string;
  try {
    normalized = normalizeUrl(url);
  } catch {
    return false;
  }

  const [row] = await db
    .select({ id: urlExecutionBlocks.id })
    .from(urlExecutionBlocks)
    .where(eq(urlExecutionBlocks.url, normalized))
    .limit(1);

  return row != null;
}

export async function getDoNotExecuteUrlSet(urls: string[]): Promise<Set<string>> {
  const unique = [...new Set(urls.filter(Boolean))];
  if (unique.length === 0) return new Set();

  const rows = await db
    .select({ url: urlExecutionBlocks.url })
    .from(urlExecutionBlocks)
    .where(inArray(urlExecutionBlocks.url, unique));

  return new Set(rows.map((row) => row.url));
}

/** Persist the URL block and skip pending/running jobs for it. */
export async function markJobUrlDoNotExecute(jobId: number): Promise<{
  id: number;
  url: string;
  status: string;
}> {
  const [job] = await db
    .select({
      id: jobs.id,
      url: jobs.url,
      status: jobs.status,
      ingestLinkItemId: jobs.ingestLinkItemId,
    })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!job) {
    throw HttpError.notFound("Job not found.");
  }

  const url = normalizeUrl(job.url);

  await db
    .insert(urlExecutionBlocks)
    .values({ url })
    .onConflictDoNothing({ target: urlExecutionBlocks.url });

  await db
    .update(jobs)
    .set({
      status: "skipped",
      errorMessage: DO_NOT_EXECUTE_REASON,
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.url, url), inArray(jobs.status, ["pending", "running"])));

  try {
    const { refreshBatchRunStatusForJob } = await import(
      "../admin/batchRuns.service.js"
    );
    await refreshBatchRunStatusForJob({
      ingestLinkItemId: job.ingestLinkItemId,
      url,
    });
  } catch {
    // Batch refresh is best-effort; the URL block still applies.
  }

  const [updated] = await db
    .select({ id: jobs.id, url: jobs.url, status: jobs.status })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  return updated ?? { id: job.id, url, status: job.status };
}
