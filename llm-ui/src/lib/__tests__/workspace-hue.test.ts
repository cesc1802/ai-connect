import { describe, it, expect } from "vitest";
import { wsHue } from "../workspace-hue";

describe("wsHue", () => {
  it("is deterministic for the same id", () => {
    expect(wsHue("ws-marketing")).toBe(wsHue("ws-marketing"));
  });

  it("stays within the 0-359 hue range", () => {
    for (const id of ["", "a", "ws-1", "550e8400-e29b-41d4-a716-446655440000", "✓ unicode ✓"]) {
      const hue = wsHue(id);
      expect(hue).toBeGreaterThanOrEqual(0);
      expect(hue).toBeLessThan(360);
      expect(Number.isInteger(hue)).toBe(true);
    }
  });

  it("gives different ids different hues (typical case)", () => {
    expect(wsHue("ws-marketing")).not.toBe(wsHue("ws-engineering"));
  });
});
