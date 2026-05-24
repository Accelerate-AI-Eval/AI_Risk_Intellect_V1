import { Router } from "express";
import { authRouter } from "./auth.routes.js";
import { usersRouter } from "./users.routes.js";
import { adminRouter } from "./admin.routes.js";
import { articlesRouter } from "./articles.routes.js";
import { jobsRouter } from "./jobs.routes.js";
import { risksRouter } from "./risks.routes.js";

export const apiRouter: Router = Router();

apiRouter.get("/health", (_req, res) => {
  res.json({ status: "ok", uptime: process.uptime() });
});

apiRouter.use("/auth", authRouter);
apiRouter.use("/users", usersRouter);
apiRouter.use("/admin", adminRouter);
apiRouter.use("/articles", articlesRouter);
apiRouter.use("/jobs", jobsRouter);
apiRouter.use("/risks", risksRouter);
