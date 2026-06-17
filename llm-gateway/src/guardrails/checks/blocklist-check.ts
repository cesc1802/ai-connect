import type { GuardrailCheck, GuardrailCheckConfig } from "../types.js";
import { scanAndRedact, type SpanMatch } from "./segment-scanner.js";

/**
 * ReDoS mitigation. User-supplied patterns run in-tenant on the shared event
 * loop, so a malicious or accidental catastrophic-backtracking regex could hang
 * the worker. We cannot make an arbitrary regex safe, but we bound the blast
 * radius: cap pattern length, segment length, and the number of compiled
 * matchers. A workspace is single-tenant, limiting who is exposed.
 */
const MAX_PATTERN_LENGTH = 200;
const MAX_INPUT_LENGTH = 100_000;
const MAX_TERMS = 100;
const MAX_PATTERNS = 50;

function escapeLiteral(term: string): string {
  return term.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function asStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.map(String) : [];
}

/**
 * Compile the configured terms and patterns into global regexes. Literal terms
 * become word-boundary matches; user patterns compile defensively (invalid →
 * skipped, over-length → skipped). Flags always include `g`; `i` unless the
 * caller overrides via `options.flags`.
 */
function compileMatchers(config: GuardrailCheckConfig): RegExp[] {
  const opts = config.options ?? {};
  const flags = ensureGlobal(typeof opts["flags"] === "string" ? (opts["flags"] as string) : "gi");
  const regexes: RegExp[] = [];

  for (const term of asStringArray(opts["terms"]).slice(0, MAX_TERMS)) {
    if (!term || term.length > MAX_PATTERN_LENGTH) continue;
    regexes.push(new RegExp(`\\b${escapeLiteral(term)}\\b`, flags));
  }

  for (const pattern of asStringArray(opts["patterns"]).slice(0, MAX_PATTERNS)) {
    if (!pattern || pattern.length > MAX_PATTERN_LENGTH) continue;
    try {
      regexes.push(new RegExp(pattern, flags));
    } catch {
      // Invalid user pattern: skip rather than fail the whole request.
    }
  }

  return regexes;
}

function ensureGlobal(flags: string): string {
  return flags.includes("g") ? flags : `${flags}g`;
}

function makeMatcher(regexes: RegExp[]) {
  return (text: string): SpanMatch[] => {
    if (text.length > MAX_INPUT_LENGTH) return []; // oversize input: skip matching
    const matches: SpanMatch[] = [];
    for (const regex of regexes) {
      regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = regex.exec(text)) !== null) {
        if (m.index === regex.lastIndex) regex.lastIndex++; // guard zero-width
        if (m[0].length === 0) continue;
        matches.push({ start: m.index, end: m.index + m[0].length, label: "blocklist", severity: "medium" });
      }
    }
    return matches;
  };
}

const maskFor = (): string => "[BLOCKED]";

/** Factory: keyword/regex blocklist check. */
export function createBlocklistCheck(config: GuardrailCheckConfig): GuardrailCheck {
  const match = makeMatcher(compileMatchers(config));
  return {
    id: "blocklist",
    kind: "blocklist",
    async run({ request }) {
      return scanAndRedact(request, "blocklist", "blocklist", match, maskFor);
    },
  };
}
