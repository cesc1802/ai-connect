import type { ErrorRequestHandler } from "express";
import type { Logger } from "../logger.js";

export interface ErrorResponse {
  code: string;
  message: string;
}

export function createErrorHandler(logger: Logger, isProd: boolean): ErrorRequestHandler {
  return (err, _req, res, _next) => {
    const status = (err as { status?: number }).status ?? 500;
    const code = (err as { code?: string }).code ?? "INTERNAL_ERROR";
    const message = isProd && status === 500 ? "Internal server error" : err.message;

    if (status >= 500) {
      logger.error({ err, status }, "Unhandled error");
    } else {
      logger.warn({ err, status }, "Client error");
    }

    const response: ErrorResponse = { code, message };
    res.status(status).json(response);
  };
}
