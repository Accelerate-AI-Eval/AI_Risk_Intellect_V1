import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  approveReviewRiskHandler,
  getRiskByIdHandler,
  listReviewQueueHandler,
  listRisksHandler,
  listTaxonomyDomainsHandler,
} from "../controllers/risks/risks.controller.js";

export const risksRouter: Router = Router();

risksRouter.get("/", requireAuth, asyncHandler(listRisksHandler));
risksRouter.get(
  "/review-queue",
  requireAuth,
  asyncHandler(listReviewQueueHandler),
);
risksRouter.get(
  "/taxonomy-domains",
  requireAuth,
  asyncHandler(listTaxonomyDomainsHandler),
);
risksRouter.post(
  "/:id/review/approve",
  requireAuth,
  asyncHandler(approveReviewRiskHandler),
);
risksRouter.get("/:id", requireAuth, asyncHandler(getRiskByIdHandler));
