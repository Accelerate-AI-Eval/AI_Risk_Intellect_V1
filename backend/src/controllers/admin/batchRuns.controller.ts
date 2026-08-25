import type { Request, Response } from "express";
import {
  getBatchRunById,
  listBatchRuns,
  startBatchRun,
  deleteBatchRun,
} from "../../services/admin/batchRuns.service.js";
import type { StartBatchRunInput } from "../../validators/admin.validators.js";

export async function startBatchRunHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const input = req.body as StartBatchRunInput;
  const result = await startBatchRun(input);
  res.status(200).json({
    ok: true,
    message: result.message,
    batch: result.batch,
    services: result.services,
  });
}

export async function listBatchRunsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const limitRaw = Number(req.query.limit);
  const limit = Number.isFinite(limitRaw) ? limitRaw : 25;
  const batches = await listBatchRuns(limit);
  res.status(200).json({ batches });
}

export async function getBatchRunHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const id = Number(req.params.id);
  const batch = await getBatchRunById(id);
  res.status(200).json({ batch });
}

export async function deleteBatchRunHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const id = Number(req.params.id);
  const batch = await deleteBatchRun(id);
  res.status(200).json({
    ok: true,
    message:
      batch.status === "running"
        ? "Processing batch deleted. Remaining jobs for this batch were removed from the queue."
        : "Queued batch deleted.",
    batch,
  });
}
