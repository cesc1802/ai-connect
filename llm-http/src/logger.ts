import pino, { type Logger } from "pino";
import type { Config } from "./config.js";

export type { Logger };

export function createLogger(config: Config): Logger {
  if (config.NODE_ENV === "development") {
    return pino({
      level: config.LOG_LEVEL,
      transport: { target: "pino-pretty", options: { colorize: true } },
    });
  }
  return pino({ level: config.LOG_LEVEL });
}
