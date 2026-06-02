import { inArray } from "drizzle-orm";
import { db } from "../../db/index.js";
import {
  ACTIVE_JOB_STATUSES,
  createArticleWithIngestJob,
} from "../../jobs/jobFactory.js";
import { jobs } from "../../schema/jobs/jobs.js";
import { normalizeUrl } from "../../utils/fetchUtils.js";

function isMissingIngestRefColumnError(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  return (
    message.includes('column "ingest_link_id" does not exist') ||
    message.includes('column "ingest_link_item_id" does not exist')
  );
}

/** URLs with a pending or running job — port of Python active-job dedupe. */
export async function getActiveJobUrls(): Promise<Set<string>> {
  const rows = await db
    .select({ url: jobs.url })
    .from(jobs)
    .where(inArray(jobs.status, [...ACTIVE_JOB_STATUSES]));
  return new Set(rows.map((r) => r.url));
}

export type DiscoveryEnqueueItem = {
  url: string;
  ingestLinkId?: number | null;
  ingestLinkItemId?: number | null;
};

/**
 * Queue discovery URLs as article shell + pending ingest job.
 * SSRF / AI classification run later in the job worker (not at discovery).
 */
export async function enqueueDiscoveryBatch(
  items: DiscoveryEnqueueItem[],
): Promise<number> {
  let count = 0;
  let supportsIngestRefs = true;

  for (const item of items) {
    let normalized: string;
    try {
      normalized = normalizeUrl(item.url);
    } catch {
      continue;
    }

    let result;
    if (supportsIngestRefs) {
      try {
        result = await db.transaction(async (tx) =>
          createArticleWithIngestJob(tx, {
            url: normalized,
            source: "rss",
            ingestLinkId: item.ingestLinkId ?? null,
            ingestLinkItemId: item.ingestLinkItemId ?? null,
          }),
        );
      } catch (err) {
        if (!isMissingIngestRefColumnError(err)) {
          throw err;
        }
        supportsIngestRefs = false;
      }
    }

    if (!result) {
      result = await db.transaction(async (tx) =>
        createArticleWithIngestJob(tx, {
          url: normalized,
          source: "rss",
        }),
      );
    }

    if (result.jobCreated) {
      count += 1;
    }
  }

  return count;
}
