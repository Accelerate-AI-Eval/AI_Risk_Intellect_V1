import type { Request, Response } from "express";
import { importReportsFile } from "../../services/admin/etlImport.service.js";

export async function uploadReportsEtlHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const suggestedName =
    typeof req.body?.suggestedName === "string" ? req.body.suggestedName : undefined;

  const summary = await importReportsFile(req.file as Express.Multer.File, {
    suggestedName,
  });

  res.status(200).json({
    ok: true,
    message: "reports import completed.",
    ...summary,
  });
}
