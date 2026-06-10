import { describe, it, expect } from "vitest";
import { slugify, hueFromString } from "../slugify";

describe("slugify", () => {
  it("strips Vietnamese diacritics", () => {
    expect(slugify("Dự Án Marketing")).toBe("du-an-marketing");
  });

  it("maps đ/Đ to d", () => {
    expect(slugify("Đối Tác Đặc Biệt")).toBe("doi-tac-dac-biet");
  });

  it("collapses separators and trims edge hyphens", () => {
    expect(slugify("  Hello -- World!  ")).toBe("hello-world");
  });

  it("returns empty string for symbol-only input", () => {
    expect(slugify("!!!")).toBe("");
  });

  it("caps at 50 chars without a trailing hyphen", () => {
    const long = "a".repeat(49) + " " + "b".repeat(50);
    const slug = slugify(long);
    expect(slug).toBe("a".repeat(49));
    expect(slug.length).toBeLessThanOrEqual(50);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("hueFromString", () => {
  it("is deterministic and within [0, 360)", () => {
    expect(hueFromString("e-commerce")).toBe(hueFromString("e-commerce"));
    for (const s of ["a", "banking", "du-an-marketing", ""]) {
      const h = hueFromString(s);
      expect(h).toBeGreaterThanOrEqual(0);
      expect(h).toBeLessThan(360);
    }
  });

  it("differs across typical slugs", () => {
    expect(hueFromString("e-commerce")).not.toBe(hueFromString("banking"));
  });
});
