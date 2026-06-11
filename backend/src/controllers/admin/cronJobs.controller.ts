import type { Request, Response } from "express";
import {
  listCronJobs,
  saveCronJobSchedule,
  stopCronJobSchedule,
} from "../../services/admin/cronJobs.service.js";
import { HttpError } from "../../utils/httpError.js";
import type {
  CronJobIdParams,
  SaveCronJobInput,
} from "../../validators/admin.validators.js";

export async function listCronJobsHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  res.status(200).json({ ok: true, jobs: await listCronJobs() });
}

export async function saveCronJobHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as CronJobIdParams;
  const body = req.body as SaveCronJobInput;

  try {
    const job = await saveCronJobSchedule(id, body);
    res.status(200).json({
      ok: true,
      message:
        "Cron job saved. Discovery and worker services started to queue and process ingest jobs.",
      job,
      jobs: await listCronJobs(),
    });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 400;
    const message =
      err instanceof Error ? err.message : "Could not save cron job.";
    res.status(status).json({
      ok: false,
      error: { message },
    });
  }
}

export async function stopCronJobHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { id } = req.params as CronJobIdParams;

  try {
    const job = await stopCronJobSchedule(id);
    res.status(200).json({
      ok: true,
      message: "Cron job stopped.",
      job,
      jobs: await listCronJobs(),
    });
  } catch (err) {
    const status = err instanceof HttpError ? err.status : 400;
    const message =
      err instanceof Error ? err.message : "Could not stop cron job.";
    res.status(status).json({
      ok: false,
      error: { message },
    });
  }
}
