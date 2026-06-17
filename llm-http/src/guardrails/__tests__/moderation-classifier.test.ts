import { describe, it, expect, vi } from "vitest";
import type { ChatRequest, ChatResponse } from "llm-gateway";
import {
  ModerationClassifier,
  parseVerdict,
  type ModerationGateway,
} from "../moderation-classifier.js";

function stubGateway(content: string): { gateway: ModerationGateway; chat: ReturnType<typeof vi.fn> } {
  const chat = vi.fn(async (_req: ChatRequest): Promise<ChatResponse> =>
    ({ content } as unknown as ChatResponse));
  return { gateway: { chat }, chat };
}

describe("parseVerdict", () => {
  it("parses a clean JSON verdict", () => {
    expect(parseVerdict('{"flagged": true, "categories": ["hate"]}')).toEqual({
      flagged: true,
      categories: ["hate"],
    });
  });

  it("extracts the JSON object when wrapped in prose", () => {
    expect(parseVerdict('Sure: {"flagged": false, "categories": []} done')).toEqual({
      flagged: false,
      categories: [],
    });
  });

  it("treats a non-true flagged value as not flagged", () => {
    expect(parseVerdict('{"flagged": "yes"}')).toEqual({ flagged: false, categories: [] });
  });

  it("drops non-string category entries", () => {
    expect(parseVerdict('{"flagged": true, "categories": ["sexual", 7, null]}')).toEqual({
      flagged: true,
      categories: ["sexual"],
    });
  });

  it("throws when the reply contains no JSON", () => {
    expect(() => parseVerdict("no verdict here")).toThrow();
  });
});

describe("ModerationClassifier", () => {
  it("sends the text to the gateway and returns the parsed verdict", async () => {
    const { gateway, chat } = stubGateway('{"flagged": true, "categories": ["violence"]}');
    const classifier = new ModerationClassifier(gateway, "moderation-model");

    const verdict = await classifier.moderate("some user text");

    expect(verdict).toEqual({ flagged: true, categories: ["violence"] });
    const req = chat.mock.calls[0]![0] as ChatRequest;
    expect(req.model).toBe("moderation-model");
    expect(req.temperature).toBe(0);
    expect(req.messages[req.messages.length - 1]).toEqual({ role: "user", content: "some user text" });
  });

  it("propagates a gateway error as moderation-unavailable", async () => {
    const chat = vi.fn(async (): Promise<ChatResponse> => {
      throw new Error("upstream down");
    });
    const classifier = new ModerationClassifier({ chat }, "moderation-model");

    await expect(classifier.moderate("text")).rejects.toThrow("upstream down");
  });
});
