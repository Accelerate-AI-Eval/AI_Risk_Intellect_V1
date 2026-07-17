import { asc, eq, inArray, sql } from "drizzle-orm";
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
  await db
    .update(jobs)
    .set({
      status,
      errorMessage,
      updatedAt: new Date(),
    })
    .where(eq(jobs.id, jobId));

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

  try {
    const [articleRow] = await db
      .select({ title: articles.title })
      .from(articles)
      .where(eq(articles.id, job.articleId))
      .limit(1);

    log("ingest start", { url: job.url, jobSource: job.source });
    const ingest = await processUrlToDb(job.url, job.articleId, {
      title: articleRow?.title ?? undefined,
    });

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
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    jobLog.error("Job failed", { jobId: job.id, message, err });
    await finishJob(job.id, "error", message, batchRefresh);
  }
}

/** Claim and process a single job, if any are pending. */
export async function runOneJob(): Promise<boolean> {
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
