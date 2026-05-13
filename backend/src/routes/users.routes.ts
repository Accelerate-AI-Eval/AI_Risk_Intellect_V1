import { Router } from "express";
import { requireAuth } from "../middleware/auth.middleware.js";
import { validate } from "../middleware/validate.js";
import { asyncHandler } from "../utils/asyncHandler.js";
import {
  inviteUserHandler,
  listUsersHandler,
} from "../controllers/users/users.controller.js";
import { inviteUserSchema } from "../validators/users.validators.js";

export const usersRouter: Router = Router();

usersRouter.get("/", requireAuth, asyncHandler(listUsersHandler));
usersRouter.post(
  "/invite",
  requireAuth,
  validate(inviteUserSchema),
  asyncHandler(inviteUserHandler),
);
