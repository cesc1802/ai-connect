import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import pino from "pino";
import { eq, like } from "drizzle-orm";
import { providers } from "@ai-connect/db";
import type { ChatRequest } from "llm-gateway";
import type { Config } from "../config.js";
import { buildContainer, type AppContainer } from "../container.js";

const runIf = process.env.DATABASE_URL ? describe : describe.skip;

const NAME_PREFIX = "provider-lifecycle-e2e-";
const ACTOR = { userId: "u-e2e", orgId: "org-e2e" };
// The gateway clamps refreshTtlMs to a 1s minimum, so this is the fastest
// effective refresh; the poll windows below are sized against it.
const REFRESH_TTL_MS = 1_000;

function testConfig(): Config {
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
    PROVIDER_REFRESH_TTL_MS: REFRESH_TTL_MS,
  };
}

function chatRequest(): ChatRequest {
  return {
    model: "llama3.2",
    messages: [{ role: "user", content: "hello" }],
    maxTokens: 16,
  };
}

/** Minimal Ollama /api/chat stand-in so the test never needs a real model server. */
function startOllamaStub(): Promise<{ server: Server; baseUrl: string }> {
  return new Promise((resolve) => {
    const server = createServer((_req, res) => {
      res.writeHead(200, { "Content-Type": "application/json" });
      res.end(
        JSON.stringify({
          model: "llama3.2",
          created_at: new Date().toISOString(),
          message: { role: "assistant", content: "stub-reply" },
          done: true,
          prompt_eval_count: 1,
          eval_count: 1,
        })
      );
    });
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as AddressInfo;
      resolve({ server, baseUrl: `http://127.0.0.1:${String(port)}` });
    });
  });
}

async function pollUntil(predicate: () => Promise<boolean>, timeoutMs = 5_000): Promise<boolean> {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    if (await predicate()) return true;
    await new Promise((resolve) => setTimeout(resolve, 60));
  }
  return predicate();
}

runIf("provider lifecycle end-to-end (Postgres)", () => {
  let container: AppContainer;
  let stub: { server: Server; baseUrl: string };

  async function cleanupRows() {
    await container.dbClient.db
      .delete(providers)
      .where(like(providers.alias, `${NAME_PREFIX}%`));
  }

  // Other suites running in parallel insert enabled rows of the same kinds;
  // a future updatedAt makes this test's row win the per-kind dedup.
  async function winDedup(providerId: string) {
    await container.dbClient.db
      .update(providers)
      .set({ updatedAt: new Date(Date.now() + 3_600_000) })
      .where(eq(providers.id, providerId));
  }

  beforeAll(async () => {
    stub = await startOllamaStub();
    container = await buildContainer(testConfig(), pino({ level: "silent" }));
    await cleanupRows();
  });

  afterAll(async () => {
    await cleanupRows();
    await container.chatHandler.dispose();
    await container.chatGateway.dispose();
    await container.dbClient.close();
    await new Promise((resolve) => stub.server.close(resolve));
  });

  it(
    "makes an admin-created provider chat-usable within the TTL and removes it after disable, without restart",
    async () => {
      // No usable provider yet: chat must fail, not hang or crash the server.
      await expect(container.chatGateway.chat(chatRequest())).rejects.toThrow();

      const wire = await container.orgProvidersService.add(ACTOR, {
        displayName: `${NAME_PREFIX}ollama`,
        providerKind: "ollama",
        apiKey: "",
        baseUrl: stub.baseUrl,
      });
      await winDedup(wire.id);

      const usable = await pollUntil(async () => {
        try {
          const res = await container.chatGateway.chat(chatRequest());
          return res.content === "stub-reply";
        } catch {
          return false;
        }
      });
      expect(usable).toBe(true);

      await container.orgProvidersService.update(ACTOR, wire.id, { isEnabled: false });

      const removed = await pollUntil(async () => {
        try {
          await container.chatGateway.chat(chatRequest());
          return false;
        } catch {
          return true;
        }
      });
      expect(removed).toBe(true);
    },
    15_000
  );
});
