import { Injectable } from "@nestjs/common";
import type { Request } from "express";
import * as jwt from "jsonwebtoken";

export const SESSION_TIMEOUT_MINUTES = 10;

const jwtSign =
  (jwt as { default?: { sign: typeof jwt.sign }; sign: typeof jwt.sign })
    .default?.sign ?? jwt.sign;
const jwtVerify =
  (jwt as { default?: { verify: typeof jwt.verify }; verify: typeof jwt.verify })
    .default?.verify ?? jwt.verify;

@Injectable()
export class TokenService {
  private get secret() {
    return process.env.JWT_SECRET ?? "change-me-in-production";
  }

  sign(userId: string): string {
    return jwtSign({ sub: userId }, this.secret, { expiresIn: "7d" });
  }

  verify(token: string): { sub: string } | null {
    try {
      return jwtVerify(token, this.secret) as { sub: string };
    } catch {
      return null;
    }
  }

  getTokenFromRequest(req: Request): string | null {
    return (
      (req.headers.authorization?.startsWith("Bearer ")
        ? req.headers.authorization.slice(7)
        : null) ??
      (req.cookies?.jwt as string | undefined) ??
      null
    );
  }

  getSessionExpiration(): Date {
    return new Date(Date.now() + SESSION_TIMEOUT_MINUTES * 60_000);
  }
}
