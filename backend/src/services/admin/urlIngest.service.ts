import { db } from "../../db/index.js";
import { createArticleWithIngestJob } from "../../jobs/jobFactory.js";
import { HttpError } from "../../utils/httpError.js";
import {
  normalizeUrl,
  validateUrl,
  UrlFetchError,
} from "../../utils/fetchUtils.js";

export type EnqueueUrlResult = {
  article: {
    id: number;
    url: string;
    createdAt: Date;
  };
  job: {
    id: number;
    url: string;
    status: string;
    jobType: string;
    source: string;
    createdAt: Date;
  };
  created: boolean;
  deduplicated?: boolean;
};

function mapUrlFetchError(err: UrlFetchError): HttpError {
  switch (err.code) {
    case "INVALID_URL":
      return HttpError.badRequest(err.message);
    case "SSRF_BLOCKED":
    case "DNS_FAILED":
      return HttpError.forbidden(err.message);
    case "NOT_FOUND":
      return HttpError.notFound(err.message);
    case "UNREACHABLE":
      return HttpError.serviceUnavailable(err.message);
    default:
      return HttpError.badRequest(err.message);
  }
}

/**
 * SSRF-safe URL check, then queue article shell + pending job for the worker.
 * Active pending/running jobs are deduped (port of `job_factory.create_job`).
 */
export async function enqueueUrl(rawUrl: string): Promise<EnqueueUrlResult> {
  let normalized: string;
  try {
    normalized = normalizeUrl(rawUrl);
  } catch {
    throw HttpError.badRequest("URL is not valid.");
  }

  try {
    await validateUrl(normalized);
  } catch (err) {
    if (err instanceof UrlFetchError) throw mapUrlFetchError(err);
    throw err;
  }

  const result = await db.transaction(async (tx) =>
    createArticleWithIngestJob(tx, {
      url: normalized,
      source: "manual",
    }),
  );

  // Port of job_factory.create_job: dedupe only active (pending/running) jobs, not article history.
  if (!result.jobCreated) {
    throw HttpError.conflict("This URL is already present.");
  }

  return {
    article: result.article,
    job: {
      id: result.job.id,
      url: result.job.url,
      status: result.job.status,
      jobType: result.job.jobType,
      source: result.job.source,
      createdAt: result.job.createdAt,
    },
    created: result.jobCreated,
    deduplicated: !result.jobCreated,
  };
}
