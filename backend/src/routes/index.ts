import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { usersRouter } from "./users.routes.js";

export const apiRouter: Router = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
