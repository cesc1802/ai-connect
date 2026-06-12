import { describe, it, expect, vi } from "vitest";
import type { IncomingMessage } from "node:http";
import type { JwtService } from "../../auth/jwt-service.js";
import { authenticateUpgrade } from "../ws-upgrade-auth.js";

function makeReq(url: string): IncomingMessage {
  return { url, headers: { host: "localhost:3000" } } as IncomingMessage;
}

function makeJwt(verify: JwtService["verify"]): JwtService {
  return { sign: vi.fn(), verify } as unknown as JwtService;
}

describe("authenticateUpgrade", () => {
  it("resolves the JWT identity for a valid token", () => {
    const jwt = makeJwt(
      vi.fn().mockReturnValue({ sub: "u-1", username: "alice" })
    );

    const result = authenticateUpgrade(makeReq("/ws/chat/v2?token=good"), jwt);

    expect(result).toEqual({ user: { id: "u-1", username: "alice" } });
    expect(jwt.verify).toHaveBeenCalledWith("good");
  });

  it("rejects when the token query param is missing", () => {
    const jwt = makeJwt(vi.fn());

    const result = authenticateUpgrade(makeReq("/ws/chat/v2"), jwt);

    expect(result).toEqual({ error: "missing_token" });
    expect(jwt.verify).not.toHaveBeenCalled();
  });

  it("rejects when token verification throws", () => {
    const jwt = makeJwt(
      vi.fn().mockImplementation(() => {
        throw new Error("expired");
      })
    );

    const result = authenticateUpgrade(makeReq("/ws/chat/v2?token=bad"), jwt);

    expect(result).toEqual({ error: "invalid_token" });
  });
});
