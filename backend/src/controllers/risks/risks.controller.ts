import type { Request, Response } from "express";
import { approveReviewRisk } from "../../services/risks/riskReview.service.js";
import {
  getRiskById,
  listReviewQueueRisks,
  listRisks,
} from "../../services/risks/risks.service.js";

export async function listRisksHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const result = await listRisks();
  res.status(200).json(result);
}

export async function listReviewQueueHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const result = await listReviewQueueRisks();
  res.status(200).json(result);
}

export async function getRiskByIdHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const riskId = String(req.params.id ?? "").trim();
  const risk = await getRiskById(riskId);
  res.status(200).json({ risk });
}

export async function approveReviewRiskHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const riskId = String(req.params.id ?? "").trim();
  const result = await approveReviewRisk(riskId);
  res.status(200).json(result);
}
