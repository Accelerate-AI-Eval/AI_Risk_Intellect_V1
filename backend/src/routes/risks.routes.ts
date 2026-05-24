import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  getRiskByIdHandler,
  listRisksHandler,
} from "../controllers/risks/risks.controller.js";

export const risksRouter: Router = Router();

risksRouter.get("/", requireAuth, asyncHandler(listRisksHandler));
risksRouter.get("/:id", requireAuth, asyncHandler(getRiskByIdHandler));
