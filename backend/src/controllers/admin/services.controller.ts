import type { Request, Response } from "express";
import {
  getServicesStatus,
  startDiscoveryProcess,
  stopDiscoveryProcess,
} from "../../services/admin/discoveryManager.service.js";
import {
  startWorkerProcess,
  stopWorkerProcess,
} from "../../services/admin/workerManager.service.js";

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
