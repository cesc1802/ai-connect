import { describe, it, expect } from "vitest";
import type { ChatRequest } from "../../core/types.js";
import {
  extractSegments,
  applySegmentRedactions,
  applyRedactions,
  type RedactionSpan,
} from "../message-text.js";

describe("extractSegments", () => {
  it("covers all scan surfaces: message string, multi-block, tool def, tool-call args, user, image url", () => {
    const request: ChatRequest = {
      model: "m",
      maxTokens: 10,
      user: "user-123",
      messages: [
        { role: "user", content: "plain string" },
        {
          role: "user",
          content: [
            { type: "text", text: "block text" },
            { type: "image", source: { type: "url", mediaType: "image/png", data: "https://x/img.png" } },
            { type: "image", source: { type: "base64", mediaType: "image/png", data: "AAAA" } },
          ],
        },
        // assistant tool-call carried at runtime though not in the typed shape
        {
          role: "assistant",
          content: "",
          // @ts-expect-error runtime-only field, read defensively by extractor
          toolCalls: [{ function: { arguments: '{"q":"secret"}' } }],
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "search",
            description: "find things",
            parameters: { type: "object", properties: { q: { type: "string" } } },
          },
        },
      ],
    };

    const segs = extractSegments(request);

    // plain string message
    expect(segs).toContainEqual({ channel: "message", messageIndex: 0, text: "plain string" });
    // multi-block text + image url (base64 image excluded)
    expect(segs).toContainEqual({ channel: "message", messageIndex: 1, blockIndex: 0, text: "block text" });
    expect(segs).toContainEqual({ channel: "message", messageIndex: 1, blockIndex: 1, text: "https://x/img.png" });
    expect(segs.some((s) => s.text === "AAAA")).toBe(false);
    // tool-call args
    expect(segs).toContainEqual({ channel: "tool_call_args", messageIndex: 2, blockIndex: 0, text: '{"q":"secret"}' });
    // tool def description + params blob
    expect(segs).toContainEqual({ channel: "tool_def", messageIndex: 0, blockIndex: 0, text: "find things" });
    expect(segs.some((s) => s.channel === "tool_def" && s.blockIndex === 1)).toBe(true);
    // user field
    expect(segs).toContainEqual({ channel: "user", text: "user-123" });
  });
});

describe("applySegmentRedactions", () => {
  it("returns the same reference when there are no redactions", () => {
    const request: ChatRequest = { model: "m", maxTokens: 10, messages: [{ role: "user", content: "hi" }] };
    expect(applySegmentRedactions(request, [])).toBe(request);
  });

  it("rewrites only targeted segments and leaves the original untouched", () => {
    const request: ChatRequest = {
      model: "m",
      maxTokens: 10,
      user: "raw-user",
      messages: [
        { role: "user", content: "leak me" },
        { role: "user", content: [{ type: "text", text: "keep me" }] },
      ],
    };

    const out = applySegmentRedactions(request, [
      { channel: "message", messageIndex: 0, text: "[MASK]" },
      { channel: "user", text: "[USER]" },
    ]);

    expect(out).not.toBe(request);
    expect(out.messages[0]!.content).toBe("[MASK]");
    expect(out.messages[1]!.content).toEqual([{ type: "text", text: "keep me" }]);
    expect(out.user).toBe("[USER]");
    // original unchanged
    expect(request.messages[0]!.content).toBe("leak me");
    expect(request.user).toBe("raw-user");
  });

  const toolRequest = (): ChatRequest => ({
    model: "m",
    maxTokens: 10,
    messages: [{ role: "user", content: "hi" }],
    tools: [
      {
        type: "function",
        function: { name: "search", description: "d", parameters: { type: "object" } },
      },
    ],
  });

  it("reparses redacted tool parameters back into an object", () => {
    const out = applySegmentRedactions(toolRequest(), [
      { channel: "tool_def", messageIndex: 0, blockIndex: 1, text: '{"type":"object","title":"[MASK]"}' },
    ]);
    expect(out.tools![0]!.function.parameters).toEqual({ type: "object", title: "[MASK]" });
  });

  it("falls back to the original parameters when a redaction leaves invalid JSON", () => {
    const out = applySegmentRedactions(toolRequest(), [
      { channel: "tool_def", messageIndex: 0, blockIndex: 1, text: '{"type":"obje[MASK]' },
    ]);
    // No throw; the original schema is preserved rather than corrupting the request.
    expect(out.tools![0]!.function.parameters).toEqual({ type: "object" });
  });
});

describe("applyRedactions", () => {
  const mask = (label: string) => `[${label}]`;

  it("masks a single span", () => {
    expect(applyRedactions("my key is sk-123 ok", [{ start: 10, end: 16, label: "SECRET" }], mask)).toBe(
      "my key is [SECRET] ok",
    );
  });

  it("masks multiple spans right-to-left preserving earlier offsets", () => {
    const spans: RedactionSpan[] = [
      { start: 0, end: 3, label: "A" },
      { start: 8, end: 11, label: "B" },
    ];
    expect(applyRedactions("abc-xyz-def", spans, mask)).toBe("[A]-xyz-[B]");
  });

  it("merges overlapping spans keeping the first label", () => {
    const spans: RedactionSpan[] = [
      { start: 0, end: 5, label: "FIRST" },
      { start: 3, end: 8, label: "SECOND" },
    ];
    expect(applyRedactions("0123456789", spans, mask)).toBe("[FIRST]89");
  });

  it("returns text unchanged when there are no spans", () => {
    expect(applyRedactions("untouched", [], mask)).toBe("untouched");
  });
});
