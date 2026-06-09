import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { enqueueUrlHandler } from "../controllers/admin/admin.controller.js";
import { enqueueJobUrlHandler } from "../controllers/admin/manualJobEnqueue.controller.js";
import {
  archiveIngestLinkHandler,
  extractIngestLinkHandler,
  listIngestLinkItemsHandler,
  listIngestLinksHandler,
  restoreIngestLinkHandler,
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
  enqueueJobUrlSchema,
  enqueueUrlSchema,
  ingestLinkIdSchema,
  setLlmModelSchema,
  startDiscoverySchema,
  updateIngestLinkSchema,
  startReportsRunSchema,
} from "../validators/admin.validators.js";
import { etlUploadMiddleware } from "../middleware/upload.middleware.js";
import { uploadReportsEtlHandler } from "../controllers/admin/etlUpload.controller.js";
import {
  archiveReportUploadHandler,
  listReportUploadItemsHandler,
  listReportUploadsHandler,
} from "../controllers/admin/etlReportUploads.controller.js";
import { startReportsRunHandler } from "../controllers/admin/etlReportsRun.controller.js";
import { listReportsLogsHandler } from "../controllers/admin/reportsLogs.controller.js";


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

adminRouter.post(
  "/ingest-links/:id/restore",
  requireAuth,
  validate(ingestLinkIdSchema, "params"),
  asyncHandler(restoreIngestLinkHandler),
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
  "/enqueue",
  requireAuth,
  validate(enqueueUrlSchema),
  asyncHandler(enqueueUrlHandler),
);

adminRouter.post(
  "/jobs/enqueue",
  requireAuth,
  validate(enqueueJobUrlSchema),
  asyncHandler(enqueueJobUrlHandler),
);

adminRouter.post(
  "/etl/reports/upload",
  requireAuth,
  etlUploadMiddleware,
  asyncHandler(uploadReportsEtlHandler),
);


adminRouter.get(
  "/etl/reports/uploads",
  requireAuth,
  asyncHandler(listReportUploadsHandler),
);

adminRouter.get(
  "/etl/reports/uploads/:id/items",
  requireAuth,
  validate(ingestLinkIdSchema, "params"),
  asyncHandler(listReportUploadItemsHandler),
);

adminRouter.post(
  "/etl/reports/uploads/:id/archive",
  requireAuth,
  validate(ingestLinkIdSchema, "params"),
  asyncHandler(archiveReportUploadHandler),
);

adminRouter.post(
  "/etl/reports/upload",
  requireAuth,
  etlUploadMiddleware,
  asyncHandler(uploadReportsEtlHandler),
);

adminRouter.post(
  "/etl/reports/start",
  requireAuth,
  validate(startReportsRunSchema),
  asyncHandler(startReportsRunHandler),
);

adminRouter.get(
  "/etl/reports/logs",
  requireAuth,
  asyncHandler(listReportsLogsHandler),
);
