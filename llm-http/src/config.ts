import { z } from "zod";
import "dotenv/config";
import type { UserRecord } from "./auth/user-repository.js";

const demoUserRecordSchema = z.object({
  id: z.string(),
  username: z.string(),
  passwordHash: z.string(),
  role: z.enum(["admin", "member"]).default("member"),
});

const demoUsersSchema = z
  .string()
  .default("[]")
  .transform((s, ctx): UserRecord[] => {
    let raw: unknown;
    try {
      raw = JSON.parse(s);
    } catch {
      return [];
    }
    const parsed = z.array(demoUserRecordSchema).safeParse(raw);
    if (!parsed.success) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: "Invalid DEMO_USERS shape" });
      return z.NEVER;
    }
    return parsed.data;
  });

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  // Comma-separated list of website addresses allowed to call this API (CORS).
  CORS_ORIGIN: z
    .string()
    .default("http://localhost:5173")
    .transform((s) => s.split(",").map((o) => o.trim()).filter(Boolean)),
  JWT_SECRET: z.string().min(32, "JWT_SECRET must be at least 32 characters"),
  JWT_EXPIRES_IN: z.string().default("1h"),
  DEMO_USERS: demoUsersSchema,
  RATE_LIMIT_LOGIN_WINDOW_MS: z.coerce.number().default(15 * 60 * 1000),
  RATE_LIMIT_LOGIN_MAX: z.coerce.number().default(5),
  PROVIDER_KEY_VAULT_KEY: z.string().optional(),
  // How long the gateway serves the last DB-loaded provider set before re-checking.
  PROVIDER_REFRESH_TTL_MS: z.coerce.number().int().positive().default(60_000),
  // Optional dedicated moderation classifier. Isolated from the chat providers
  // (its own gateway + credentials) so a chat-provider outage never disables
  // moderation and vice-versa. All four must be set to enable it; otherwise the
  // moderation guardrail check stays inert.
  MODERATION_PROVIDER: z.enum(["anthropic", "openai", "ollama", "minimax"]).optional(),
  MODERATION_MODEL: z.string().optional(),
  MODERATION_API_KEY: z.string().optional(),
  MODERATION_BASE_URL: z.string().optional(),
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
