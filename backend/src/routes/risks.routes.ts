import { Router } from "express";
import { requireAuthOrApiKey } from "../middleware/requireAuthOrApiKey.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  approveReviewRiskHandler,
  classifyReviewRiskHandler,
  remapReviewDomainHandler,
  getRiskByIdHandler,
  listReviewQueueHandler,
  listRisksHandler,
  listReviewFeedbackHandler,
  listTaxonomyDomainsHandler,
  pendingReviewCountHandler,
  rejectReviewRiskHandler,
  updateReviewFeedbackHandler,
} from "../controllers/risks/risks.controller.js";
import { requireAuth } from "../middleware/auth.middleware.js";

export const risksRouter: Router = Router();

/** Read endpoints: JWT (UI) or API key (external AI-Q). */
risksRouter.get("/", requireAuthOrApiKey, asyncHandler(listRisksHandler));
risksRouter.get(
  "/review-queue",
  requireAuthOrApiKey,
  asyncHandler(listReviewQueueHandler),
);
risksRouter.get(
  "/review-queue/pending-count",
  requireAuthOrApiKey,
  asyncHandler(pendingReviewCountHandler),
);
risksRouter.get(
  "/review-feedback",
  requireAuthOrApiKey,
  asyncHandler(listReviewFeedbackHandler),
);
risksRouter.get(
  "/taxonomy-domains",
  requireAuthOrApiKey,
  asyncHandler(listTaxonomyDomainsHandler),
);
risksRouter.get("/:id", requireAuthOrApiKey, asyncHandler(getRiskByIdHandler));

/** Review mutations stay JWT-only (interactive UI). */
risksRouter.post(
  "/:id/review/approve",
  requireAuth,
  asyncHandler(approveReviewRiskHandler),
);
risksRouter.patch(
  "/:id/review/domain",
  requireAuth,
  asyncHandler(remapReviewDomainHandler),
);
risksRouter.post(
  "/:id/review/reject",
  requireAuth,
  asyncHandler(rejectReviewRiskHandler),
);
risksRouter.post(
  "/:id/review/classify",
  requireAuth,
  asyncHandler(classifyReviewRiskHandler),
);
risksRouter.patch(
  "/:id/review/feedback",
  requireAuth,
  asyncHandler(updateReviewFeedbackHandler),
);
