import { describe, expect, it } from "vitest";
import { apiMemberToUser } from "../api-member-adapter";
import { hueFromString } from "../slugify";

describe("apiMemberToUser", () => {
  it("renders username on both the name and email lines", () => {
    const u = apiMemberToUser({ userId: "u1", username: "thuoc", orgRole: "member" });
    expect(u.name).toBe("thuoc");
    expect(u.email).toBe("thuoc");
  });

  it("derives a stable hue from the username", () => {
    const a = apiMemberToUser({ userId: "u1", username: "thuoc", orgRole: "member" });
    const b = apiMemberToUser({ userId: "u2", username: "thuoc", orgRole: "admin" });
    expect(a.hue).toBe(hueFromString("thuoc"));
    expect(b.hue).toBe(a.hue);
  });

  it("maps id and org role through unchanged", () => {
    const u = apiMemberToUser({ userId: "u9", username: "nga", orgRole: "admin" });
    expect(u.id).toBe("u9");
    expect(u.org).toBe("admin");
  });
});
