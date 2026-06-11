/**
 * Deterministic JSON serialization: object keys are sorted at every depth so
 * semantically equal values serialize identically regardless of key order.
 * undefined-valued keys are dropped (matching JSON.stringify semantics).
 *
 * Used for provider-config change detection across refreshes.
 */
export function stableStringify(value: unknown): string {
  return JSON.stringify(sortDeep(value));
}

function sortDeep(value: unknown): unknown {
  if (Array.isArray(value)) {
    return value.map(sortDeep);
  }
  if (value !== null && typeof value === "object") {
    const source = value as Record<string, unknown>;
    const sorted: Record<string, unknown> = {};
    for (const key of Object.keys(source).sort()) {
      if (source[key] !== undefined) {
        sorted[key] = sortDeep(source[key]);
      }
    }
    return sorted;
  }
  return value;
}
