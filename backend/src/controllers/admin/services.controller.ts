import type { Request, Response } from "express";
import {
  getServicesStatus,
  startDiscoveryProcess,
  stopDiscoveryProcess,
} from "../../services/admin/discoveryManager.service.js";
import {
  getLlmModelConfig,
  setLlmModel,
} from "../../services/admin/llmModelConfig.service.js";
import {
  startWorkerProcess,
  stopWorkerProcess,
} from "../../services/admin/workerManager.service.js";
import type { SetLlmModelInput } from "../../validators/admin.validators.js";

export async function getServicesStatusHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  res.status(200).json({ services: getServicesStatus() });
}

export async function startDiscoveryHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const { pid } = startDiscoveryProcess();
  res.status(200).json({
    ok: true,
    message: "Discovery service started.",
    pid,
    services: getServicesStatus(),
  });
}

export async function stopDiscoveryHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  stopDiscoveryProcess();
  res.status(200).json({
    ok: true,
    message: "Discovery service stop requested.",
    services: getServicesStatus(),
  });
}

export async function startWorkerHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const { pid } = startWorkerProcess();
  res.status(200).json({
    ok: true,
    message: "Worker service started.",
    pid,
    services: getServicesStatus(),
  });
}

export async function stopWorkerHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  stopWorkerProcess();
  res.status(200).json({
    ok: true,
    message: "Worker service stop requested.",
    services: getServicesStatus(),
  });
}

export async function getLlmModelHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  res.status(200).json({ ok: true, ...getLlmModelConfig() });
}

export async function setLlmModelHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { modelId } = req.body as SetLlmModelInput;
  try {
    const config = await setLlmModel(modelId);
    res.status(200).json({
      ok: true,
      message: "LLM model updated.",
      ...config,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Could not update LLM model.";
    res.status(400).json({
      ok: false,
      error: { message },
    });
  }
}
