import { inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  ACTIVE_JOB_STATUSES,
  createArticleWithIngestJob,
} from "../../jobs/jobFactory.js";
import { jobs } from "../../schema/jobs/jobs.js";
import { normalizeUrl } from "../../utils/fetchUtils.js";

/** URLs with a pending or running job — port of Python active-job dedupe. */
export async function getActiveJobUrls(): Promise<Set<string>> {
  const rows = await db
    .select({ url: jobs.url })
    .from(jobs)
    .where(inArray(jobs.status, [...ACTIVE_JOB_STATUSES]));
  return new Set(rows.map((r) => r.url));
}

/**
 * Queue discovery URLs as article shell + pending ingest job.
 * SSRF / AI classification run later in the job worker (not at discovery).
 */
export async function enqueueDiscoveryBatch(urls: string[]): Promise<number> {
  let count = 0;

  for (const raw of urls) {
    let normalized: string;
    try {
      normalized = normalizeUrl(raw);
    } catch {
      continue;
    }

    const result = await db.transaction(async (tx) =>
      createArticleWithIngestJob(tx, {
        url: normalized,
        source: "rss",
      }),
    );

    if (result.jobCreated) {
      count += 1;
    }
  }

  return count;
}
