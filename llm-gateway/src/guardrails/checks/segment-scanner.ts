import type { ChatRequest } from "../../core/types.js";
import {
  extractSegments,
  applyRedactions,
  applySegmentRedactions,
  type RedactionSpan,
  type SegmentRedaction,
} from "../message-text.js";
import type {
  GuardrailFinding,
  GuardrailKind,
  GuardrailResult,
  GuardrailSeverity,
} from "../types.js";

/** One located match within a segment's text — offsets + non-sensitive label. */
export interface SpanMatch {
  start: number;
  end: number;
  label: string;
  severity: GuardrailSeverity;
}

/** Find every match within a single text. Pure; never throws. */
export type SegmentMatcher = (text: string) => SpanMatch[];

/**
 * Run a span matcher over the full request scan surface, emit one finding per
 * match (offsets + label only — never the matched value), and produce a
 * redacted copy of the request. Shared by the deterministic checks so the
 * scan/finding/redaction wiring lives in exactly one place.
 */
export function scanAndRedact(
  request: ChatRequest,
  checkId: string,
  kind: GuardrailKind,
  match: SegmentMatcher,
  maskFor: (label: string) => string,
): GuardrailResult {
  const findings: GuardrailFinding[] = [];
  const redactions: SegmentRedaction[] = [];

  for (const seg of extractSegments(request)) {
    const matches = match(seg.text);
    if (matches.length === 0) continue;

    const locator = {
      channel: seg.channel,
      ...(seg.messageIndex !== undefined && { messageIndex: seg.messageIndex }),
      ...(seg.blockIndex !== undefined && { blockIndex: seg.blockIndex }),
    };

    for (const m of matches) {
      findings.push({
        checkId,
        kind,
        ...locator,
        start: m.start,
        end: m.end,
        label: m.label,
        severity: m.severity,
      });
    }

    const spans: RedactionSpan[] = matches.map((m) => ({ start: m.start, end: m.end, label: m.label }));
    redactions.push({ ...locator, text: applyRedactions(seg.text, spans, maskFor) });
  }

  return {
    findings,
    ...(redactions.length > 0 && { transformedRequest: applySegmentRedactions(request, redactions) }),
  };
}
