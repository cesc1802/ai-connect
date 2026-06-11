import { describe, it, expect } from "vitest";
import { wsShortName } from "../workspace-display-name";

describe("wsShortName", () => {
  it("strips the 'Dự Án ' prefix", () => {
    expect(wsShortName("Dự Án Phoenix")).toBe("Phoenix");
  });

  it("returns names without the prefix untouched", () => {
    expect(wsShortName("Marketing")).toBe("Marketing");
  });

  it("only strips the prefix at the start", () => {
    expect(wsShortName("Team Dự Án X")).toBe("Team Dự Án X");
  });

  it("falls back to the full name when stripping leaves nothing", () => {
    expect(wsShortName("Dự Án ")).toBe("Dự Án ");
  });
});
