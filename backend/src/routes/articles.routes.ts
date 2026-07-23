import { Router } from "express";
import { requireAuthOrApiKey } from "../middleware/requireAuthOrApiKey.middleware.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import { listArticlesHandler } from "../controllers/articles/articles.controller.js";

export const articlesRouter: Router = Router();

articlesRouter.get("/", requireAuthOrApiKey, asyncHandler(listArticlesHandler));
