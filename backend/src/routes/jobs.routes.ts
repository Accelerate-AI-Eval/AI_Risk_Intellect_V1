import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { requireAuthOrApiKey } from "../middleware/requireAuthOrApiKey.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listJobsHandler, deleteJobHandler } from "../controllers/jobs/jobs.controller.js";
import { retryJobHandler } from "../controllers/jobs/retryJob.controller.js";

export const jobsRouter: Router = Router();

jobsRouter.get("/", requireAuthOrApiKey, asyncHandler(listJobsHandler));
jobsRouter.post("/:id/retry", requireAuth, asyncHandler(retryJobHandler));
jobsRouter.delete("/:id", requireAuth, asyncHandler(deleteJobHandler));
