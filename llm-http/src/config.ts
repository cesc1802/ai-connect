import { z } from "zod";
import "dotenv/config";

const configSchema = z.object({
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  PORT: z.coerce.number().int().positive().default(3000),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),
  ANTHROPIC_API_KEY: z.string().optional(),
  OPENAI_API_KEY: z.string().optional(),
  OLLAMA_BASE_URL: z.string().url().optional(),
  MINIMAX_API_KEY: z.string().optional(),
  JWT_SECRET: z.string().optional(),
  DEMO_USERS: z.string().default("[]"),
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
