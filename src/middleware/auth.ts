import type { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const JWT_SECRET = resolveJwtSecret();
export const ACCESS_TOKEN_MINUTES = 30;
export const REFRESH_TOKEN_DAYS = 7;
/** @deprecated Use ACCESS_TOKEN_MINUTES. Kept so older admin clients still compile. */
export const SESSION_TIMEOUT_MINUTES = ACCESS_TOKEN_MINUTES;

const jwtSign =
  (jwt as any).default?.sign ??
  ((jwt as any).sign as (
    payload: unknown,
    secret: string,
    options: any,
  ) => string);
const jwtVerify =
  (jwt as any).default?.verify ??
  ((jwt as any).verify as (token: string, secret: string) => unknown);

export interface AuthUser {
  id: string;
  email: string;
  name: string | null;
  image: string | null;
  role: "USER" | "ADMIN";
}

export interface AuthRequest extends Request {
  user?: AuthUser;
}

interface AccessTokenPayload {
  sub: string;
  typ: "access";
}

function resolveJwtSecret(): string {
  const secret = process.env.JWT_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("JWT_SECRET is not set");
  }
  console.warn("JWT_SECRET is not set; using an insecure development default");
  return "change-me-in-production";
}

export function signToken(userId: string): string {
  return jwtSign({ sub: userId, typ: "access" } satisfies AccessTokenPayload, JWT_SECRET, {
    expiresIn: `${ACCESS_TOKEN_MINUTES}m`,
  });
}

export function verifyToken(token: string): { sub: string } | null {
  try {
    const payload = jwtVerify(token, JWT_SECRET) as AccessTokenPayload;
    if (payload?.typ !== "access" || typeof payload.sub !== "string") return null;
    return { sub: payload.sub };
  } catch {
    return null;
  }
}

export function getTokenFromRequest(req: Request): string | null {
  return (
    (req.headers.authorization?.startsWith("Bearer ")
      ? req.headers.authorization.slice(7)
      : null) ??
    (req.cookies?.jwt as string | undefined) ??
    null
  );
}

export function getRefreshTokenFromRequest(req: Request): string | null {
  const bodyToken =
    typeof req.body?.refreshToken === "string" ? req.body.refreshToken : null;
  const cookieToken =
    typeof req.cookies?.refresh === "string" ? req.cookies.refresh : null;
  return bodyToken || cookieToken || null;
}

export function getRefreshExpiration(): Date {
  return new Date(Date.now() + REFRESH_TOKEN_DAYS * 24 * 60 * 60_000);
}

/** @deprecated Use getRefreshExpiration. */
export function getSessionExpiration(): Date {
  return getRefreshExpiration();
}

/** Attach user from a short-lived access JWT. Does not touch the Session table. */
export async function requireAuth(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  const token = getTokenFromRequest(req);

  if (!token) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  const payload = verifyToken(token);
  if (!payload) {
    res.status(401).json({ error: "Invalid or expired token" });
    return;
  }

  const user = await prisma.user.findUnique({
    where: { id: payload.sub },
    select: { id: true, email: true, name: true, image: true, role: true },
  });

  if (!user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  req.user = user;
  next();
}

export async function requireAdmin(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  await requireAuth(req, res, () => {
    if (req.user?.role !== "ADMIN") {
      res.status(403).json({ error: "Admin access required" });
      return;
    }

    next();
  });
}
