import { describe, it, expect, vi } from "vitest";
import { randomBytes } from "node:crypto";
import pino from "pino";
import type { Config } from "./config.js";
import type { Logger } from "./logger.js";
import { buildContainer, warmUpProviderSource } from "./container.js";
import { LlmGatewayAdapter } from "./chat-v2/llm-gateway-adapter.js";

function testConfig(overrides: Partial<Config> = {}): Config {
  return {
    NODE_ENV: "test",
    PORT: 3000,
    LOG_LEVEL: "error",
    CORS_ORIGIN: ["http://localhost:5173"],
    JWT_SECRET: "a-test-jwt-secret-of-at-least-32-chars",
    JWT_EXPIRES_IN: "1h",
    DEMO_USERS: [],
    RATE_LIMIT_LOGIN_WINDOW_MS: 15 * 60 * 1000,
    RATE_LIMIT_LOGIN_MAX: 5,
    PROVIDER_KEY_VAULT_KEY: undefined,
    PROVIDER_REFRESH_TTL_MS: 60_000,
    ...overrides,
  };
}

function fakeLogger(): { logger: Logger; warn: ReturnType<typeof vi.fn> } {
  const warn = vi.fn();
  return { logger: { warn } as unknown as Logger, warn };
}

describe("warmUpProviderSource", () => {
  it("warns when the source has no providers", async () => {
    const { logger, warn } = fakeLogger();
    await warmUpProviderSource({ load: async () => ({}) }, logger);
    expect(warn).toHaveBeenCalledTimes(1);
  });

  it("does not warn when providers exist", async () => {
    const { logger, warn } = fakeLogger();
    await warmUpProviderSource(
      { load: async () => ({ ollama: { baseUrl: "http://localhost:11434" } }) },
      logger
    );
    expect(warn).not.toHaveBeenCalled();
  });

  it("warns instead of throwing when the source fails", async () => {
    const { logger, warn } = fakeLogger();
    await expect(
      warmUpProviderSource(
        {
          load: async () => {
            throw new Error("db down");
          },
        },
        logger
      )
    ).resolves.toBeUndefined();
    expect(warn).toHaveBeenCalledTimes(1);
  });
});

const runIf = process.env.DATABASE_URL ? describe : describe.skip;

runIf("buildContainer (Postgres)", () => {
  async function teardown(container: Awaited<ReturnType<typeof buildContainer>>) {
    await container.chatHandler.dispose();
    await container.chatGateway.dispose();
    await container.dbClient.close();
  }

  it("boots without provider env vars and serves chat through the live gateway adapter", async () => {
    const container = await buildContainer(testConfig(), pino({ level: "silent" }));
    try {
      expect(container.chatGateway).toBeInstanceOf(LlmGatewayAdapter);
    } finally {
      await teardown(container);
    }
  });

  it("boots in production mode with no provider env config", async () => {
    const container = await buildContainer(
      testConfig({
        NODE_ENV: "production",
        PROVIDER_KEY_VAULT_KEY: randomBytes(32).toString("hex"),
      }),
      pino({ level: "silent" })
    );
    try {
      expect(container.chatGateway).toBeInstanceOf(LlmGatewayAdapter);
    } finally {
      await teardown(container);
    }
  });
});
