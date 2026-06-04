import jwt from "jsonwebtoken";
import type { JWTPayload, OrgRole, User, WorkspaceRole } from "@ai-connect/shared";

export interface JwtSignContext {
  org: string;
  orgRole: OrgRole;
  workspace: string | null;
  workspaceRole: WorkspaceRole | null;
}

export class JwtService {
  private readonly options: jwt.SignOptions;

  constructor(
    private secret: string,
    expiresIn: string
  ) {
    this.options = { expiresIn: expiresIn as `${number}${"s" | "m" | "h" | "d"}` };
  }

  sign(user: User, ctx: JwtSignContext): string {
    const claims = {
      sub: user.id,
      username: user.username,
      org: ctx.org,
      orgRole: ctx.orgRole,
      workspace: ctx.workspace,
      workspaceRole: ctx.workspaceRole,
    };
    return jwt.sign(claims, this.secret, this.options);
  }

  verify(token: string): JWTPayload {
    return jwt.verify(token, this.secret, { algorithms: ["HS256"] }) as JWTPayload;
  }
}
