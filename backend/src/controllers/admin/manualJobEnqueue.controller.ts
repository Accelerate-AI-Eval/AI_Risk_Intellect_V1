import type { Request, Response } from "express";
import { enqueueManualJobUrl } from "../../services/admin/manualJobEnqueue.service.js";
import type { EnqueueJobUrlInput } from "../../validators/admin.validators.js";

export async function enqueueJobUrlHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { url } = req.body as EnqueueJobUrlInput;
  const result = await enqueueManualJobUrl(url);

  res.status(201).json({
    ok: true,
    message: "URL enqueued for ingestion.",
    job: result.job,
    created: result.created,
  });
}
