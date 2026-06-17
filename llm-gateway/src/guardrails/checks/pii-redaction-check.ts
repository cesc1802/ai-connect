import type { GuardrailCheck, GuardrailCheckConfig, GuardrailSeverity } from "../types.js";
import { scanAndRedact, type SpanMatch } from "./segment-scanner.js";

/**
 * A single PII/secret detector. All built-in regexes are author-controlled and
 * linear (no nested quantifiers) — they run on untrusted content but cannot be
 * driven to catastrophic backtracking. `validate` lets a detector reject a
 * structural match (e.g. credit card by Luhn) to cut false positives.
 */
interface Detector {
  label: string;
  severity: GuardrailSeverity;
  regex: RegExp;
  validate?: (match: string) => boolean;
}

function luhnValid(match: string): boolean {
  const digits = match.replace(/\D/g, "");
  if (digits.length < 13 || digits.length > 19) return false;
  let sum = 0;
  let double = false;
  for (let i = digits.length - 1; i >= 0; i--) {
    let d = digits.charCodeAt(i) - 48;
    if (double) {
      d *= 2;
      if (d > 9) d -= 9;
    }
    sum += d;
    double = !double;
  }
  return sum % 10 === 0;
}

// Order matters only for label clarity; overlapping spans are merged at redaction.
const DETECTORS: Detector[] = [
  { label: "email", severity: "medium", regex: /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g },
  { label: "openai_key", severity: "high", regex: /sk-[A-Za-z0-9]{20,}/g },
  { label: "aws_access_key", severity: "high", regex: /AKIA[0-9A-Z]{16}/g },
  { label: "bearer_token", severity: "high", regex: /Bearer\s+[A-Za-z0-9._~+/-]{10,}=*/g },
  {
    label: "credit_card",
    severity: "high",
    regex: /\b(?:\d[ -]?){13,19}\b/g,
    validate: luhnValid,
  },
  {
    label: "ipv4",
    severity: "low",
    regex: /\b(?:(?:25[0-5]|2[0-4]\d|1?\d?\d)\.){3}(?:25[0-5]|2[0-4]\d|1?\d?\d)\b/g,
  },
  {
    label: "phone",
    severity: "low",
    regex: /\+?\d{1,3}[\s.-]?\(?\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g,
  },
];

function detectorsFor(config: GuardrailCheckConfig): Detector[] {
  const requested = config.options?.["detectors"];
  if (!Array.isArray(requested)) return DETECTORS;
  const allow = new Set(requested.map(String));
  return DETECTORS.filter((d) => allow.has(d.label));
}

/** Build a matcher running the enabled detectors over one text. */
function makeMatcher(detectors: Detector[]) {
  return (text: string): SpanMatch[] => {
    const matches: SpanMatch[] = [];
    for (const detector of detectors) {
      detector.regex.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = detector.regex.exec(text)) !== null) {
        const value = m[0];
        if (m.index === detector.regex.lastIndex) detector.regex.lastIndex++; // guard zero-width
        if (detector.validate && !detector.validate(value)) continue;
        matches.push({
          start: m.index,
          end: m.index + value.length,
          label: detector.label,
          severity: detector.severity,
        });
      }
    }
    return matches;
  };
}

const maskFor = (label: string): string => `[REDACTED:${label.toUpperCase()}]`;

/** Factory: PII/secret redaction check. Detectors selectable via options. */
export function createPiiRedactionCheck(config: GuardrailCheckConfig): GuardrailCheck {
  const match = makeMatcher(detectorsFor(config));
  return {
    id: "pii-redaction",
    kind: "pii",
    async run({ request }) {
      return scanAndRedact(request, "pii-redaction", "pii", match, maskFor);
    },
  };
}
