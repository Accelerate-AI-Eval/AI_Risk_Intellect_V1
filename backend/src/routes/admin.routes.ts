import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { enqueueUrlHandler } from "../controllers/admin/admin.controller.js";
import {
  getLlmModelHandler,
  getServicesStatusHandler,
  setLlmModelHandler,
  startDiscoveryHandler,
  startWorkerHandler,
  stopDiscoveryHandler,
  stopWorkerHandler,
} from "../controllers/admin/services.controller.js";
import {
  enqueueUrlSchema,
  setLlmModelSchema,
} from "../validators/admin.validators.js";

export const adminRouter: Router = Router();

adminRouter.get(
  "/services/status",
  requireAuth,
  asyncHandler(getServicesStatusHandler),
);

adminRouter.post(
  "/services/discovery/start",
  requireAuth,
  asyncHandler(startDiscoveryHandler),
);

adminRouter.post(
  "/services/discovery/stop",
  requireAuth,
  asyncHandler(stopDiscoveryHandler),
);

adminRouter.post(
  "/services/worker/start",
  requireAuth,
  asyncHandler(startWorkerHandler),
);

adminRouter.post(
  "/services/worker/stop",
  requireAuth,
  asyncHandler(stopWorkerHandler),
);

adminRouter.get(
  "/services/llm-model",
  requireAuth,
  asyncHandler(getLlmModelHandler),
);

adminRouter.put(
  "/services/llm-model",
  requireAuth,
  validate(setLlmModelSchema),
  asyncHandler(setLlmModelHandler),
);

adminRouter.post(
  "/enqueue",
  requireAuth,
  validate(enqueueUrlSchema),
  asyncHandler(enqueueUrlHandler),
);
