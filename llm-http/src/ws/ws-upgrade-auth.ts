import { URL } from "node:url";
import type { IncomingMessage } from "node:http";
import type { JwtService } from "../auth/jwt-service.js";
import type { User } from "@ai-connect/shared";

export type UpgradeAuthResult = { user: User } | { error: string };

export function authenticateUpgrade(
  req: IncomingMessage,
  jwtService: JwtService
): UpgradeAuthResult {
  try {
    const url = new URL(req.url ?? "", `http://${req.headers.host}`);
    const token = url.searchParams.get("token");
    if (!token) return { error: "missing_token" };
    const payload = jwtService.verify(token);
    return { user: { id: payload.sub, username: payload.username } };
  } catch {
    return { error: "invalid_token" };
  }
}
