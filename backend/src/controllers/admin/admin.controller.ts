import type { Request, Response } from "express";
import { enqueueUrl } from "../../services/admin/urlIngest.service.js";
import type { EnqueueUrlInput } from "../../validators/admin.validators.js";

export async function enqueueUrlHandler(
  req: Request,
  res: Response,
): Promise<void> {
  const { url } = req.body as EnqueueUrlInput;
  const result = await enqueueUrl(url);

  res.status(201).json({
    ok: true,
    message: "URL queued for processing.",
    ...result,
  });
}
