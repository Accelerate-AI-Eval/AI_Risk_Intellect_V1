import type { Request, Response } from "express";
import {
  archiveReportUpload,
  listActiveReportUploads,
  listReportUploadItems,
} from "../../services/admin/etlReportUploads.service.js";

export async function listReportUploadsHandler(
  _req: Request,
  res: Response,
): Promise<void> {
  const uploads = await listActiveReportUploads();
  res.json({ uploads });
}

export async function listReportUploadItemsHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const id = Number(req.params.id);
  const items = await listReportUploadItems(id);
  res.json({ items });
}

export async function archiveReportUploadHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const id = Number(req.params.id);
  const upload = await archiveReportUpload(id);

  res.json({
    ok: true,
    message: "Report upload archived.",
    upload,
  });
}
