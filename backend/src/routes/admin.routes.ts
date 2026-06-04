import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { enqueueUrlHandler } from "../controllers/admin/admin.controller.js";
import {
  archiveIngestLinkHandler,
  extractIngestLinkHandler,
  listIngestLinkItemsHandler,
  listIngestLinksHandler,
  updateIngestLinkHandler,
} from "../controllers/admin/ingestLinks.controller.js";
import { listDiscoveryLogsHandler } from "../controllers/admin/discoveryLogs.controller.js";
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
  ingestLinkIdSchema,
  setLlmModelSchema,
  startDiscoverySchema,
  updateIngestLinkSchema,
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
  validate(startDiscoverySchema),
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

adminRouter.get(
  "/discovery-logs",
  requireAuth,
  asyncHandler(listDiscoveryLogsHandler),
);

adminRouter.get(
  "/ingest-links",
  requireAuth,
  asyncHandler(listIngestLinksHandler),
);

adminRouter.patch(
  "/ingest-links/:id",
  requireAuth,
  validate(ingestLinkIdSchema, "params"),
  validate(updateIngestLinkSchema),
  asyncHandler(updateIngestLinkHandler),
);

adminRouter.post(
  "/ingest-links/:id/archive",
  requireAuth,
  validate(ingestLinkIdSchema, "params"),
  asyncHandler(archiveIngestLinkHandler),
);

adminRouter.get(
  "/ingest-links/:id/items",
  requireAuth,
  validate(ingestLinkIdSchema, "params"),
  asyncHandler(listIngestLinkItemsHandler),
);

adminRouter.post(
  "/ingest-links/:id/extract",
  requireAuth,
  validate(ingestLinkIdSchema, "params"),
  asyncHandler(extractIngestLinkHandler),
);

adminRouter.post(
  "/jobs/enqueue",
  requireAuth,
  validate(enqueueUrlSchema),
  asyncHandler(enqueueUrlHandler),
);
