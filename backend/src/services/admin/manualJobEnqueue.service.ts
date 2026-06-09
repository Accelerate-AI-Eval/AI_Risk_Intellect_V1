import { db } from "../../db/index.js";
import { createArticleWithIngestJob } from "../../jobs/jobFactory.js";
import { HttpError } from "../../utils/httpError.js";
import {
  normalizeUrl,
  validateUrl,
  UrlFetchError,
} from "../../utils/fetchUtils.js";

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

export type ManualJobEnqueueResult = {
  job: {
    id: number;
    url: string;
    status: string;
    jobType: string;
    source: string;
    createdAt: string;
  };
  created: boolean;
};

/** Queue a manual ingest job for an article URL (Jobs → Enqueue). */
export async function enqueueManualJobUrl(
  rawUrl: string,
): Promise<ManualJobEnqueueResult> {
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

  if (!result.jobCreated) {
    throw HttpError.conflict(
      "A pending or running job already exists for this URL.",
      {
        job: {
          id: result.job.id,
          url: result.job.url,
          status: result.job.status,
          jobType: result.job.jobType,
          source: result.job.source,
          createdAt: result.job.createdAt.toISOString(),
        },
      },
    );
  }

  return {
    job: {
      id: result.job.id,
      url: result.job.url,
      status: result.job.status,
      jobType: result.job.jobType,
      source: result.job.source,
      createdAt: result.job.createdAt.toISOString(),
    },
    created: true,
  };
}
