import { and, asc, eq, inArray, isNull, lt, or, sql } from "drizzle-orm";
import { db } from "../../db/index.js";
import { createLogger } from "../../logger/index.js";

const jobLog = createLogger("job");
import { ACTIVE_JOB_STATUSES } from "../../jobs/jobFactory.js";
import { articles } from "../../schema/articles/articles.js";
import { jobs } from "../../schema/jobs/jobs.js";
import { extractRiskForArticle } from "./extractRisk.service.js";
import { processUrlToDb } from "./processUrl.service.js";
import {
  ensureAssignedBatchModelForJob,
  refreshBatchRunStatusForJob,
} from "../admin/batchRuns.service.js";
import {
  DO_NOT_EXECUTE_REASON,
  isUrlDoNotExecute,
} from "../jobs/urlExecutionBlocks.service.js";
import {
  getLlmModelConfig,
  syncPythonLlmModel,
} from "../admin/llmModelConfig.service.js";

export type ClaimedJob = {
  id: number;
  articleId: number;
  url: string;
  source: "manual" | "rss" | "api" | "etl_reports";
  tries: number;
  ingestLinkItemId: number | null;
  batchRunId: number | null;
  modelName: string | null;
  modelLabel: string | null;
};

/** Skip a URL if ingest + LLM have not finished within this time. */
export const JOB_MAX_RUNTIME_MS = 5 * 60 * 1000;

export const JOB_TIMEOUT_SKIP_REASON =
  "Skipped because this URL took more than 5 minutes without finishing — it was taking too long.";

class JobTimeoutError extends Error {
  constructor() {
    super(JOB_TIMEOUT_SKIP_REASON);
    this.name = "JobTimeoutError";
  }
}

function isTimeoutSkipError(err: unknown): boolean {
  if (err instanceof JobTimeoutError) return true;
  const name = err instanceof Error ? err.name : "";
  const message = err instanceof Error ? err.message : String(err);
  if (name === "TimeoutError" || name === "AbortError") return true;
  return /timeout|timed out|aborted due to timeout|took more than 5 minutes/i.test(
    message,
  );
}

/** Claim one pending job: pending → running (increments tries). */
export async function claimNextJob(): Promise<ClaimedJob | null> {
  return db.transaction(async (tx) => {
    const [pending] = await tx
      .select({
        id: jobs.id,
        articleId: jobs.articleId,
        url: jobs.url,
        source: jobs.source,
        tries: jobs.tries,
        ingestLinkItemId: jobs.ingestLinkItemId,
        batchRunId: jobs.batchRunId,
        modelName: jobs.modelName,
        modelLabel: jobs.modelLabel,
      })
      .from(jobs)
      .where(eq(jobs.status, "pending"))
      .orderBy(asc(jobs.createdAt))
      .limit(1)
      .for("update", { skipLocked: true });

    if (!pending) {
      return null;
    }

    const runStartedAt = new Date();
    const [claimed] = await tx
      .update(jobs)
      .set({
        status: "running",
        tries: sql`${jobs.tries} + 1`,
        startedAt: runStartedAt,
        updatedAt: runStartedAt,
      })
      .where(eq(jobs.id, pending.id))
      .returning({
        id: jobs.id,
        articleId: jobs.articleId,
        url: jobs.url,
        source: jobs.source,
        tries: jobs.tries,
        ingestLinkItemId: jobs.ingestLinkItemId,
        batchRunId: jobs.batchRunId,
        modelName: jobs.modelName,
        modelLabel: jobs.modelLabel,
      });

    return claimed ?? null;
  });
}

async function finishJob(
  jobId: number,
  status: "done" | "skipped" | "error",
  errorMessage: string | null,
  batchRefresh?: { ingestLinkItemId: number | null; url: string },
): Promise<void> {
  const [existing] = await db
    .select({ id: jobs.id, url: jobs.url, status: jobs.status })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);

  if (!existing || existing.status !== "running") return;

  const blocked = await isUrlDoNotExecute(existing.url);
  const nextStatus = blocked ? "skipped" : status;
  const nextMessage = blocked ? DO_NOT_EXECUTE_REASON : errorMessage;

  await db
    .update(jobs)
    .set({
      status: nextStatus,
      errorMessage: nextMessage,
      updatedAt: new Date(),
    })
    .where(and(eq(jobs.id, jobId), eq(jobs.status, "running")));

  if (batchRefresh) {
    try {
      await refreshBatchRunStatusForJob(batchRefresh);
    } catch (err) {
      jobLog.warn("Could not refresh batch run status after job", {
        jobId,
        message: err instanceof Error ? err.message : String(err),
      });
    }
  }
}

async function jobStillExists(jobId: number): Promise<boolean> {
  const [row] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.id, jobId))
    .limit(1);
  return row != null;
}

/** Skip running jobs that have been in flight longer than 5 minutes. */
export async function skipStaleRunningJobs(): Promise<number> {
  const cutoff = new Date(Date.now() - JOB_MAX_RUNTIME_MS);
  const stale = await db
    .select({
      id: jobs.id,
      url: jobs.url,
      ingestLinkItemId: jobs.ingestLinkItemId,
    })
    .from(jobs)
    .where(
      and(
        eq(jobs.status, "running"),
        or(
          lt(jobs.startedAt, cutoff),
          and(isNull(jobs.startedAt), lt(jobs.updatedAt, cutoff)),
        ),
      ),
    );

  for (const job of stale) {
    jobLog.info("skipping URL after 5 minutes without progress", {
      jobId: job.id,
      url: job.url,
    });
    await finishJob(job.id, "skipped", JOB_TIMEOUT_SKIP_REASON, {
      ingestLinkItemId: job.ingestLinkItemId,
      url: job.url,
    });
  }

  return stale.length;
}

/**
 * Resolve the model this job must use:
 * 1) model snapshotted on the job row at enqueue time
 * 2) model assigned to the batch (if any)
 * 3) live Controls model (legacy fallback)
 */
async function resolveJobExtractionModel(job: ClaimedJob): Promise<{
  modelId: string;
  modelLabel: string;
  batchId: number | null;
}> {
  const jobModel = job.modelName?.trim() || null;
  if (jobModel) {
    await syncPythonLlmModel(jobModel);
    return {
      modelId: jobModel,
      modelLabel: job.modelLabel?.trim() || jobModel,
      batchId: job.batchRunId,
    };
  }

  const batchModel = await ensureAssignedBatchModelForJob({
    batchRunId: job.batchRunId,
    ingestLinkItemId: job.ingestLinkItemId,
    url: job.url,
  });
  if (batchModel?.modelName?.trim()) {
    return {
      modelId: batchModel.modelName.trim(),
      modelLabel:
        batchModel.modelLabel?.trim() || batchModel.modelName.trim(),
      batchId: batchModel.batchId,
    };
  }

  const activeModel = getLlmModelConfig();
  const modelId = activeModel.modelId?.trim() || "unknown";
  return {
    modelId,
    modelLabel: activeModel.modelLabel?.trim() || modelId,
    batchId: null,
  };
}

/**
 * Process one claimed job through the status machine:
 * running → done | skipped | error
 */
export async function processClaimedJob(job: ClaimedJob): Promise<void> {
  const log = (msg: string, extra?: Record<string, unknown>) => {
    jobLog.info(msg, { jobId: job.id, ...extra });
  };

  const batchRefresh = {
    ingestLinkItemId: job.ingestLinkItemId,
    url: job.url,
  };

  const runWork = async (): Promise<void> => {
    if (await isUrlDoNotExecute(job.url)) {
      log("do not execute, skipping LLM");
      await finishJob(job.id, "skipped", DO_NOT_EXECUTE_REASON, batchRefresh);
      return;
    }

    const [articleRow] = await db
      .select({ title: articles.title })
      .from(articles)
      .where(eq(articles.id, job.articleId))
      .limit(1);

    log("ingest start", { url: job.url, jobSource: job.source });
    const ingest = await processUrlToDb(job.url, job.articleId, {
      title: articleRow?.title ?? undefined,
    });

    if (!(await jobStillExists(job.id))) {
      log("deleted during ingest, aborting");
      return;
    }

    if (await isUrlDoNotExecute(job.url)) {
      log("do not execute after ingest, skipping LLM");
      await finishJob(job.id, "skipped", DO_NOT_EXECUTE_REASON, batchRefresh);
      return;
    }

    if (ingest.outcome === "skipped") {
      log("ingest skipped", { reason: ingest.reason });
      await finishJob(job.id, "skipped", ingest.reason, batchRefresh);
      return;
    }

    log("ingest done", { articleId: ingest.articleId });

    const assigned = await resolveJobExtractionModel(job);

    console.log(
      `[batch-worker] extracting url=${job.url} batchId=${assigned.batchId ?? "—"} model=${assigned.modelLabel} (${assigned.modelId}) jobId=${job.id} source=${job.source}`,
    );
    jobLog.info("risk extract start", {
      jobId: job.id,
      url: job.url,
      batchId: assigned.batchId,
      modelId: assigned.modelId,
      modelLabel: assigned.modelLabel,
      jobSource: job.source,
      modelSource: job.modelName?.trim()
        ? "job"
        : assigned.batchId != null
          ? "batch"
          : "controls",
    });

    const extract = await extractRiskForArticle(job.articleId, {
      modelId: assigned.modelId !== "unknown" ? assigned.modelId : null,
    });

    if (!(await jobStillExists(job.id))) {
      log("deleted during risk extract, aborting");
      return;
    }

    if (await isUrlDoNotExecute(job.url)) {
      log("do not execute after extract, skipping");
      await finishJob(job.id, "skipped", DO_NOT_EXECUTE_REASON, batchRefresh);
      return;
    }

    if (extract.outcome === "skipped") {
      log("risk extract skipped", { reason: extract.reason });
      await finishJob(job.id, "skipped", extract.reason, batchRefresh);
      return;
    }

    log(
      extract.created ? "done" : "done (risk already exists for this model)",
      {
        riskId: extract.riskId,
        created: extract.created,
        modelName: extract.modelName,
        url: job.url,
      },
    );
    await finishJob(job.id, "done", null, batchRefresh);
  };

  let timeoutHandle: ReturnType<typeof setTimeout> | null = null;
  const timeoutPromise = new Promise<never>((_, reject) => {
    timeoutHandle = setTimeout(() => reject(new JobTimeoutError()), JOB_MAX_RUNTIME_MS);
  });

  try {
    await Promise.race([runWork(), timeoutPromise]);
  } catch (err) {
    if (isTimeoutSkipError(err)) {
      log("skipped URL after 5 minutes without progress", { url: job.url });
      if (await jobStillExists(job.id)) {
        await finishJob(job.id, "skipped", JOB_TIMEOUT_SKIP_REASON, batchRefresh);
      }
      return;
    }
    const message = err instanceof Error ? err.message : String(err);
    jobLog.error("Job failed", { jobId: job.id, message, err });
    if (!(await jobStillExists(job.id))) return;
    await finishJob(job.id, "error", message, batchRefresh);
  } finally {
    if (timeoutHandle) clearTimeout(timeoutHandle);
  }
}

/** Claim and process a single job, if any are pending. */
export async function runOneJob(): Promise<boolean> {
  await skipStaleRunningJobs();
  const job = await claimNextJob();
  if (!job) {
    return false;
  }
  await processClaimedJob(job);
  return true;
}

/** True when at least one ingest job is waiting to run. */
export async function hasPendingJobs(): Promise<boolean> {
  const [row] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(eq(jobs.status, "pending"))
    .limit(1);

  return row != null;
}

/** True when any ingest job is pending or currently running. */
export async function hasActiveIngestJobs(): Promise<boolean> {
  const [row] = await db
    .select({ id: jobs.id })
    .from(jobs)
    .where(inArray(jobs.status, [...ACTIVE_JOB_STATUSES]))
    .limit(1);

  return row != null;
}
