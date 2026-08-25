import type { Request, Response } from "express";
import { deleteJob, listJobs } from "../../services/jobs/jobs.service.js";

export async function listJobsHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const result = await listJobs();
  res.status(200).json(result);
}

export async function deleteJobHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const jobId = Number.parseInt(String(req.params.id), 10);
  if (!Number.isFinite(jobId) || jobId < 1) {
    res.status(400).json({ error: { message: "Invalid job id." } });
    return;
  }

  const result = await deleteJob(jobId);
  res.status(200).json({
    ok: true,
    message: "Job deleted.",
    job: result,
  });
}
