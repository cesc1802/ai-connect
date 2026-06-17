import type { GuardrailCheckRegistry } from "../types.js";
import { createPiiRedactionCheck } from "./pii-redaction-check.js";
import { createBlocklistCheck } from "./blocklist-check.js";
import { createInjectionCheck } from "./injection-check.js";
import { createModerationCheck } from "./moderation-check.js";

/**
 * Built-in check factories keyed by kind: deterministic (pii/blocklist) and
 * advanced (injection/moderation). The engine skips any kind absent here, so a
 * partially-populated registry is safe.
 */
export const DEFAULT_CHECK_REGISTRY: GuardrailCheckRegistry = {
  pii: (config) => createPiiRedactionCheck(config),
  blocklist: (config) => createBlocklistCheck(config),
  injection: (config) => createInjectionCheck(config),
  moderation: (config) => createModerationCheck(config),
};
