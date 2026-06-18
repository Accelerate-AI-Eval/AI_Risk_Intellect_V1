import type { Request, Response } from "express";
import { approveReviewRisk } from "../../services/risks/riskReview.service.js";
import {
  getRiskById,
  getTaxonomyDomains,
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

export async function listTaxonomyDomainsHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const result = getTaxonomyDomains();
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
  const body = (req.body ?? {}) as { domain?: string };
  const domain =
    typeof body.domain === "string" ? body.domain.trim() : undefined;
  const result = await approveReviewRisk(riskId, { domain });
  res.status(200).json(result);
}
