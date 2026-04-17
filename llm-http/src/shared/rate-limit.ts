import rateLimit, { type Options } from "express-rate-limit";
import type { Request } from "express";

export interface RateLimitConfig {
  windowMs: number;
  max: number;
  keyBy?: "ip" | "user";
  code?: string;
  message?: string;
}

export function createRateLimit(cfg: RateLimitConfig) {
  const opts: Partial<Options> = {
    windowMs: cfg.windowMs,
    max: cfg.max,
    standardHeaders: "draft-7",
    legacyHeaders: false,
    message: { code: cfg.code ?? "rate_limited", message: cfg.message ?? "Too many requests" },
  };

  if (cfg.keyBy === "user") {
    opts.keyGenerator = (req: Request) => req.user?.id ?? req.ip ?? "anon";
  }

  return rateLimit(opts);
}
