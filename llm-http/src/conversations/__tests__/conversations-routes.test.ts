import { describe, it, expect } from "vitest";
import express from "express";
import request from "supertest";
import {
  InMemoryConversationRepository,
  InMemoryMessageRepository,
} from "../../chat-v2/__tests__/in-memory-chat-test-fakes.js";
import { createConversationsRoutes } from "../conversations-routes.js";

function makeApp(
  convRepo: InMemoryConversationRepository,
  msgRepo: InMemoryMessageRepository,
  callerId?: string
): express.Express {
  const app = express();
  if (callerId) {
    app.use((req, _res, next) => {
      req.user = {
        id: callerId,
        username: "caller",
        role: "member",
        org: "default",
        orgRole: "member",
        workspace: null,
        workspaceRole: null,
      };
      next();
    });
  }
  app.use("/conversations", createConversationsRoutes(convRepo, msgRepo));
  return app;
}

describe("conversations routes", () => {
  it("GET / returns only the caller's conversations, newest first", async () => {
    const convRepo = new InMemoryConversationRepository();
    const msgRepo = new InMemoryMessageRepository(convRepo);
    const older = await convRepo.create({
      workspaceId: "ws-1",
      userId: "u1",
      title: "Older",
      createdAt: 1000,
      updatedAt: 1000,
    });
    const newer = await convRepo.create({
      workspaceId: "ws-1",
      userId: "u1",
      templateId: "tmpl-1",
      createdAt: 2000,
      updatedAt: 2000,
    });
    await convRepo.create({
      workspaceId: "ws-1",
      userId: "u2",
      createdAt: 3000,
      updatedAt: 3000,
    });

    const res = await request(makeApp(convRepo, msgRepo, "u1")).get(
      "/conversations"
    );
    expect(res.status).toBe(200);
    expect(res.body.conversations).toHaveLength(2);
    expect(res.body.conversations[0]).toMatchObject({
      id: newer.id,
      workspaceId: "ws-1",
      title: "",
      templateId: "tmpl-1",
    });
    expect(res.body.conversations[1]).toMatchObject({
      id: older.id,
      title: "Older",
      templateId: null,
    });
  });

  it("GET / returns 401 when unauthenticated", async () => {
    const convRepo = new InMemoryConversationRepository();
    const msgRepo = new InMemoryMessageRepository(convRepo);
    const res = await request(makeApp(convRepo, msgRepo)).get("/conversations");
    expect(res.status).toBe(401);
    expect(res.body.code).toBe("missing_token");
  });

  it("GET /:id/messages returns ordered messages for the owner", async () => {
    const convRepo = new InMemoryConversationRepository();
    const msgRepo = new InMemoryMessageRepository(convRepo);
    const conv = await convRepo.create({
      workspaceId: "ws-1",
      userId: "u1",
      createdAt: 1000,
      updatedAt: 1000,
    });
    await msgRepo.append({
      conversationId: conv.id,
      role: "user",
      content: "hello",
      createdAt: 1001,
    });
    await msgRepo.append({
      conversationId: conv.id,
      role: "assistant",
      content: "hi there",
      createdAt: 1002,
    });

    const res = await request(makeApp(convRepo, msgRepo, "u1")).get(
      `/conversations/${conv.id}/messages`
    );
    expect(res.status).toBe(200);
    expect(res.body.messages).toHaveLength(2);
    expect(res.body.messages[0]).toMatchObject({ role: "user", content: "hello" });
    expect(res.body.messages[1]).toMatchObject({
      role: "assistant",
      content: "hi there",
    });
  });

  it("GET /:id/messages returns 404 for unknown conversation", async () => {
    const convRepo = new InMemoryConversationRepository();
    const msgRepo = new InMemoryMessageRepository(convRepo);
    const res = await request(makeApp(convRepo, msgRepo, "u1")).get(
      "/conversations/unknown-id/messages"
    );
    expect(res.status).toBe(404);
    expect(res.body.code).toBe("not_found");
  });

  it("GET /:id/messages returns 403 for a non-owner", async () => {
    const convRepo = new InMemoryConversationRepository();
    const msgRepo = new InMemoryMessageRepository(convRepo);
    const conv = await convRepo.create({
      workspaceId: "ws-1",
      userId: "u1",
      createdAt: 1000,
      updatedAt: 1000,
    });

    const res = await request(makeApp(convRepo, msgRepo, "u2")).get(
      `/conversations/${conv.id}/messages`
    );
    expect(res.status).toBe(403);
    expect(res.body.code).toBe("forbidden");
  });
});
