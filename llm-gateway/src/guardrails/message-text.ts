import type { ChatRequest, ChatMessage, ContentBlock, JsonSchema } from "../core/types.js";
import type { GuardrailChannel } from "./types.js";

/**
 * One scannable piece of text located within a `ChatRequest`. Checks operate on
 * these uniformly; redactions are written back via `applySegmentRedactions`.
 *
 * The locator is `(channel, messageIndex, blockIndex)`:
 * - `message`        : message content text (blockIndex set for multi-block content)
 * - `tool_def`       : a tool's description/parameters (messageIndex = tool index)
 * - `tool_call_args` : an assistant tool-call's JSON arguments
 * - `user`           : the request-level `user` field
 *
 * Image base64 payloads are intentionally NOT extracted (out of scope); image
 * `url` sources ARE scanned as `message` segments.
 */
export interface TextSegment {
  channel: GuardrailChannel;
  messageIndex?: number;
  blockIndex?: number;
  text: string;
}

/** A replacement for one previously-extracted segment, matched by its locator. */
export interface SegmentRedaction {
  channel: GuardrailChannel;
  messageIndex?: number;
  blockIndex?: number;
  text: string;
}

function locatorKey(seg: {
  channel: GuardrailChannel;
  messageIndex?: number;
  blockIndex?: number;
}): string {
  return `${seg.channel}:${seg.messageIndex ?? ""}:${seg.blockIndex ?? ""}`;
}

/** Extract every scannable text segment across the full request surface. */
export function extractSegments(request: ChatRequest): TextSegment[] {
  const segments: TextSegment[] = [];

  request.messages.forEach((message, messageIndex) => {
    collectMessageText(message, messageIndex, segments);
    collectToolCallArgs(message, messageIndex, segments);
  });

  request.tools?.forEach((tool, toolIndex) => {
    const desc = tool.function.description;
    if (desc) {
      segments.push({ channel: "tool_def", messageIndex: toolIndex, blockIndex: 0, text: desc });
    }
    // Parameters are scanned as a stringified blob; descriptions inside the
    // schema are the realistic place free-text leaks into a tool definition.
    segments.push({
      channel: "tool_def",
      messageIndex: toolIndex,
      blockIndex: 1,
      text: JSON.stringify(tool.function.parameters),
    });
  });

  if (request.user) {
    segments.push({ channel: "user", text: request.user });
  }

  return segments;
}

function collectMessageText(
  message: ChatMessage,
  messageIndex: number,
  out: TextSegment[],
): void {
  if (typeof message.content === "string") {
    out.push({ channel: "message", messageIndex, text: message.content });
    return;
  }
  message.content.forEach((block, blockIndex) => {
    const text = blockText(block);
    if (text !== null) {
      out.push({ channel: "message", messageIndex, blockIndex, text });
    }
  });
}

/** Text from a content block, or null when it carries no scannable text. */
function blockText(block: ContentBlock): string | null {
  if (block.type === "text") return block.text;
  // Image: scan a url source, never base64 payloads.
  if (block.source.type === "url") return block.source.data;
  return null;
}

function collectToolCallArgs(
  message: ChatMessage & { toolCalls?: { function: { arguments: string } }[] },
  messageIndex: number,
  out: TextSegment[],
): void {
  // ChatMessage has no typed toolCalls field today; assistant turns may still
  // carry them at runtime, so read defensively without widening the core type.
  const toolCalls = (message as { toolCalls?: { function?: { arguments?: string } }[] }).toolCalls;
  toolCalls?.forEach((call, blockIndex) => {
    const args = call.function?.arguments;
    if (typeof args === "string") {
      out.push({ channel: "tool_call_args", messageIndex, blockIndex, text: args });
    }
  });
}

/**
 * Write redacted text back into a copy of the request. The original is never
 * mutated. Only segments present in `redactions` change; everything else is
 * structurally shared.
 */
export function applySegmentRedactions(
  request: ChatRequest,
  redactions: SegmentRedaction[],
): ChatRequest {
  if (redactions.length === 0) return request;
  const byKey = new Map(redactions.map((r) => [locatorKey(r), r.text]));

  const messages = request.messages.map((message, messageIndex) =>
    rewriteMessage(message, messageIndex, byKey),
  );

  const tools = request.tools?.map((tool, toolIndex) => {
    const descKey = locatorKey({ channel: "tool_def", messageIndex: toolIndex, blockIndex: 0 });
    const paramsKey = locatorKey({ channel: "tool_def", messageIndex: toolIndex, blockIndex: 1 });
    const newDesc = byKey.get(descKey);
    const newParams = byKey.get(paramsKey);
    if (newDesc === undefined && newParams === undefined) return tool;
    return {
      ...tool,
      function: {
        ...tool.function,
        ...(newDesc !== undefined && { description: newDesc }),
        ...(newParams !== undefined && { parameters: reparseParams(newParams, tool.function.parameters) }),
      },
    };
  });

  const userKey = locatorKey({ channel: "user" });
  const user = byKey.has(userKey) ? byKey.get(userKey) : request.user;

  return { ...request, messages, ...(tools && { tools }), ...(user !== undefined && { user }) };
}

// A redaction span can land on a structural character of the stringified tool
// parameters, leaving invalid JSON. Reparse defensively: rather than throw and
// abort the turn, keep the original schema. Tool parameters are developer
// authored function signatures, not user content, so preserving them is safe.
function reparseParams(redacted: string, fallback: JsonSchema): JsonSchema {
  try {
    return JSON.parse(redacted) as JsonSchema;
  } catch {
    return fallback;
  }
}

function rewriteMessage(
  message: ChatMessage,
  messageIndex: number,
  byKey: Map<string, string>,
): ChatMessage {
  if (typeof message.content === "string") {
    const key = locatorKey({ channel: "message", messageIndex });
    const next = byKey.get(key);
    return next === undefined ? message : { ...message, content: next };
  }
  let changed = false;
  const content = message.content.map((block, blockIndex) => {
    const key = locatorKey({ channel: "message", messageIndex, blockIndex });
    const next = byKey.get(key);
    if (next === undefined) return block;
    changed = true;
    if (block.type === "text") return { ...block, text: next };
    return { ...block, source: { ...block.source, data: next } };
  });
  return changed ? { ...message, content } : message;
}

/** One half-open character span `[start, end)` to mask. */
export interface RedactionSpan {
  start: number;
  end: number;
  label: string;
}

/**
 * Mask spans within a single text. Spans are sorted and overlap-merged, then
 * applied right-to-left so earlier offsets stay valid as later ones are
 * replaced. `maskFor(label)` produces the replacement token.
 */
export function applyRedactions(
  text: string,
  spans: RedactionSpan[],
  maskFor: (label: string) => string,
): string {
  if (spans.length === 0) return text;
  const merged = mergeSpans(spans);
  let out = text;
  for (let i = merged.length - 1; i >= 0; i--) {
    const span = merged[i]!;
    out = out.slice(0, span.start) + maskFor(span.label) + out.slice(span.end);
  }
  return out;
}

function mergeSpans(spans: RedactionSpan[]): RedactionSpan[] {
  const sorted = [...spans].sort((a, b) => a.start - b.start || a.end - b.end);
  const merged: RedactionSpan[] = [];
  for (const span of sorted) {
    const last = merged[merged.length - 1];
    if (last && span.start < last.end) {
      // Overlap: extend the prior span; keep its label (first match wins).
      if (span.end > last.end) last.end = span.end;
    } else {
      merged.push({ ...span });
    }
  }
  return merged;
}
