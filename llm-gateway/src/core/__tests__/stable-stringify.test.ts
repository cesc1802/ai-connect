import { describe, it, expect } from "vitest";
import { stableStringify } from "../stable-stringify.js";

describe("stableStringify", () => {
  it("produces identical output regardless of key order", () => {
    expect(stableStringify({ a: 1, b: 2 })).toBe(stableStringify({ b: 2, a: 1 }));
  });

  it("sorts keys at every nesting depth", () => {
    const left = { outer: { z: 1, a: { y: 2, b: 3 } } };
    const right = { outer: { a: { b: 3, y: 2 }, z: 1 } };
    expect(stableStringify(left)).toBe(stableStringify(right));
  });

  it("drops undefined-valued keys like JSON.stringify", () => {
    expect(stableStringify({ a: 1, b: undefined })).toBe(stableStringify({ a: 1 }));
  });

  it("preserves array element order", () => {
    expect(stableStringify([1, 2, 3])).not.toBe(stableStringify([3, 2, 1]));
    expect(stableStringify([{ b: 1, a: 2 }])).toBe(stableStringify([{ a: 2, b: 1 }]));
  });

  it("handles primitives and null", () => {
    expect(stableStringify("text")).toBe('"text"');
    expect(stableStringify(42)).toBe("42");
    expect(stableStringify(null)).toBe("null");
  });
});
