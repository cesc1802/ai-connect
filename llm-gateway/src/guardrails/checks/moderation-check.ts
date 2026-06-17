import type { ChatRequest } from "../../core/types.js";
import { extractSegments } from "../message-text.js";
import type { GuardrailCheck, GuardrailCheckConfig, GuardrailFinding, GuardrailResult } from "../types.js";

/** Cap moderated text length to bound cost and latency of the remote call. */
const MAX_MODERATION_CHARS = 8_000;

/** Concatenate the outbound message text + tool-call args for moderation. */
function moderationText(request: ChatRequest): string {
  const parts: string[] = [];
  for (const seg of extractSegments(request)) {
    if (seg.channel === "message" || seg.channel === "tool_call_args") parts.push(seg.text);
  }
  return parts.join("\n").slice(0, MAX_MODERATION_CHARS);
}

export function createModerationCheck(config: GuardrailCheckConfig): GuardrailCheck {
  const opts = config.options ?? {};
  const failClosed = opts["failClosed"] === true;
  const allowed = Array.isArray(opts["categories"]) ? new Set(opts["categories"].map(String)) : null;

  return {
    id: "moderation",
    kind: "moderation",
    async run({ request, opts: runOpts }): Promise<GuardrailResult> {
      // No injected moderator → the check is inert (cannot moderate without it).
      if (!runOpts.moderate) return { findings: [] };

      const text = moderationText(request);
      if (!text) return { findings: [] };

      try {
        const verdict = await runOpts.moderate(text);
        if (!verdict.flagged) return { findings: [] };

        const categories = allowed
          ? verdict.categories.filter((c) => allowed.has(c))
          : verdict.categories;
        if (allowed && categories.length === 0) return { findings: [] };

        const labels = categories.length > 0 ? categories : ["flagged"];
        return {
          findings: labels.map((category) => buildFinding(`moderation:${category}`, "high")),
        };
      } catch {
        // Moderation outage. Fail-closed → block (finding, no passThrough).
        // Fail-open → pass through but record an auditable finding (never silent).
        if (failClosed) {
          return { findings: [buildFinding("moderation_unavailable", "high")] };
        }
        return { findings: [buildFinding("moderation_unavailable", "low")], passThrough: true };
      }
    },
  };
}

function buildFinding(label: string, severity: GuardrailFinding["severity"]): GuardrailFinding {
  return { checkId: "moderation", kind: "moderation", channel: "message", label, severity };
}
