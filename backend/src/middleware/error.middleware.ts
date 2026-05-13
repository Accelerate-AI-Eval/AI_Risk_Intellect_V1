import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../env.js";
import { HttpError } from "../utils/httpError.js";

export function notFoundHandler(
  req: Request,
  _res: Response,
  next: NextFunction,
): void {
  next(HttpError.notFound(`Route ${req.method} ${req.originalUrl} not found`));
}

export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof HttpError) {
    res.status(err.status).json({
      error: {
        code: err.code,
        message: err.message,
        details: err.details ?? undefined,
      },
    });
    return;
  }

  if (err instanceof ZodError) {
    res.status(400).json({
      error: {
        code: "BAD_REQUEST",
        message: "Validation failed",
        details: err.issues,
      },
    });
    return;
  }

  console.error("[unhandled error]", err);
  res.status(500).json({
    error: {
      code: "INTERNAL",
      message: "Internal server error",
      details: env.NODE_ENV === "development" ? String(err) : undefined,
    },
  });
}
