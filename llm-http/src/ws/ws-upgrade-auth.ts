import type { IncomingMessage } from "node:http";
import type { JwtService } from "../auth/jwt-service.js";
import type { User } from "@ai-connect/shared";
import { DEV_USER_ID, DEV_USERNAME } from "../auth/dev-seed-constants.js";

export type UpgradeAuthResult = { user: User } | { error: string };

export function authenticateUpgrade(
  _req: IncomingMessage,
  _jwtService: JwtService
): UpgradeAuthResult {
  // Dev-auth bypass: returns the seeded dev identity so FK constraints hold in
  // the Drizzle path. Real token verification (commented below) verifies the JWT.
  return { user: { id: DEV_USER_ID, username: DEV_USERNAME } };
  // try {
  //   const url = new URL(_req.url ?? "", `http://${_req.headers.host}`);
  //   const token = url.searchParams.get("token");
  //   if (!token) return { error: "missing_token" };
  //   const payload = _jwtService.verify(token);
  //   return { user: { id: payload.sub, username: payload.username } };
  // } catch {
  //   return { error: "invalid_token" };
  // }
}
