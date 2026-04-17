import jwt from "jsonwebtoken";
import type { JWTPayload, User } from "@ai-connect/shared";

export class JwtService {
  private readonly options: jwt.SignOptions;

  constructor(
    private secret: string,
    expiresIn: string
  ) {
    this.options = { expiresIn: expiresIn as `${number}${"s" | "m" | "h" | "d"}` };
  }

  sign(user: User): string {
    return jwt.sign({ sub: user.id, username: user.username }, this.secret, this.options);
  }

  verify(token: string): JWTPayload {
    return jwt.verify(token, this.secret, { algorithms: ["HS256"] }) as JWTPayload;
  }
}
