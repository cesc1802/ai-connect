import type { User } from "@ai-connect/shared";

declare global {
  namespace Express {
    interface Request {
      user?: User;
    }
  }
}

export {};
