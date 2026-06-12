import { describe, it, expect, vi } from "vitest";
import express from "express";
import request from "supertest";
import type { ProvidersRepository, StoredProvider } from "../providers-repository.js";
import { createMeDefaultModelRoutes } from "../me-default-model-routes.js";

function provider(overrides: Partial<StoredProvider>): StoredProvider {
  return {
    id: "p-1",
    orgId: "default",
    displayName: "OpenAI",
    providerKind: "openai",
    isEnabled: true,
    encryptedKey: "enc",
    lastFour: "1234",
    baseUrl: null,
    defaultModel: "gpt-4o",
    scope: "org",
    createdAt: "2026-01-01T00:00:00.000Z",
    updatedAt: "2026-01-01T00:00:00.000Z",
    ...overrides,
  };
}

function makeApp(providers: StoredProvider[], authed = true): express.Express {
  const repo = {
    listByOrg: vi.fn().mockResolvedValue(providers),
  } as unknown as ProvidersRepository;

  const app = express();
  if (authed) {
    app.use((req, _res, next) => {
      req.user = {
        id: "u1",
        username: "member",
        role: "member",
        org: "default",
        orgRole: "member",
        workspace: null,
        workspaceRole: null,
      };
      next();
    });
  }
  app.use("/api/me/default-model", createMeDefaultModelRoutes(repo));
  return app;
}

describe("me default model routes — GET /api/me/default-model", () => {
  it("returns the first usable provider's default model", async () => {
    const res = await request(
      makeApp([
        provider({ id: "p-0", isEnabled: false, defaultModel: "disabled-model" }),
        provider({ id: "p-1", encryptedKey: "", defaultModel: "keyless-model" }),
        provider({ id: "p-2", defaultModel: null }),
        provider({ id: "p-3", defaultModel: "gpt-4o" }),
      ])
    ).get("/api/me/default-model");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ model: "gpt-4o" });
  });

  it("treats a key-less ollama provider with a base URL as usable", async () => {
    const res = await request(
      makeApp([
        provider({
          providerKind: "ollama",
          encryptedKey: "",
          baseUrl: "http://localhost:11434",
          defaultModel: "ollama/gemma3:4b",
        }),
      ])
    ).get("/api/me/default-model");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ model: "ollama/gemma3:4b" });
  });

  it("skips an ollama provider without a base URL", async () => {
    const res = await request(
      makeApp([
        provider({
          providerKind: "ollama",
          encryptedKey: "",
          baseUrl: null,
          defaultModel: "ollama/gemma3:4b",
        }),
      ])
    ).get("/api/me/default-model");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ model: null });
  });

  it("returns null when no provider is usable", async () => {
    const res = await request(
      makeApp([provider({ isEnabled: false })])
    ).get("/api/me/default-model");

    expect(res.status).toBe(200);
    expect(res.body).toEqual({ model: null });
  });

  it("returns 401 without an authenticated user", async () => {
    const res = await request(makeApp([provider({})], false)).get("/api/me/default-model");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("missing_token");
  });
});
