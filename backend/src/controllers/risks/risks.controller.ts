import type { Request, Response } from "express";
import { getRiskById, listRisks } from "../../services/risks/risks.service.js";

export async function listRisksHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const result = await listRisks();
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
