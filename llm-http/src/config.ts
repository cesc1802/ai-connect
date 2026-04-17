import { z } from "zod";
import "dotenv/config";
import type { UserRecord } from "./auth/user-repository.js";

const demoUsersSchema = z
  .string()
  .default("[]")
  .transform((s) => {
    try {
      return JSON.parse(s) as UserRecord[];
    } catch {
      return [] as UserRecord[];
    }
  });

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().optional(),
  MINIMAX_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("1h"),
  DEMO_USERS: demoUsersSchema,
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().default(5),
  RATE_LIMIT_CHAT_WINDOW_MS: z.coerce.number().default(60 * 60 * 1000),
  RATE_LIMIT_CHAT_MAX: z.coerce.number().default(60),
});

export type Config = z.infer<typeof configSchema>;

export function loadConfig(): Config {
  const result = configSchema.safeParse(process.env);
  if (!result.success) {
    const formatted = result.error.format();
    const messages = Object.entries(formatted)
      .filter(([key]) => key !== "_errors")
      .map(([key, value]) => `  ${key}: ${(value as { _errors: string[] })._errors.join(", ")}`)
      .join("\n");
    throw new Error(`Invalid environment configuration:\n${messages}`);
  }
  return result.data;
}

export function extractProviderConfigs(config: Config) {
  const providers: Record<string, unknown> = {};

  if (config.ANTHROPIC_API_KEY) {
    providers.anthropic = { apiKey: config.ANTHROPIC_API_KEY };
  }
  if (config.OPENAI_API_KEY) {
    providers.openai = { apiKey: config.OPENAI_API_KEY };
  }
  if (config.OLLAMA_BASE_URL) {
    providers.ollama = { baseUrl: config.OLLAMA_BASE_URL };
  }
  if (config.MINIMAX_API_KEY) {
    providers.minimax = { apiKey: config.MINIMAX_API_KEY };
  }

  return providers;
}
