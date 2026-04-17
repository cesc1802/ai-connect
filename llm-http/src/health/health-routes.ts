import { Router, type Router as RouterType } from "express";
import type { AppContainer } from "../container.js";

export function createHealthRoutes(container: AppContainer): RouterType {
  const router = Router();

  router.get("/", (_req, res) => {
    const metrics = container.chatGateway.getMetrics();
    res.json({
      status: "ok",
      uptime: process.uptime(),
      providers: metrics.providers,
    });
  });

  return router;
}
