import { jobSourceEnum } from "../../schema/jobs/jobs.js";

type JobSource = (typeof jobSourceEnum.enumValues)[number];

/** RSS and ETL report URLs use the same ingest + risk pipeline as RSS discovery. */
export function resolveIngestSource(
  source: JobSource,
): "manual" | "rss" {
  if (source === "manual") return "manual";
  return "rss";
}
