import type { Request, Response, NextFunction } from "express";
import * as jwt from "jsonwebtoken";
import { prisma } from "../lib/prisma.js";

const JWT_SECRET = process.env.JWT_SECRET ?? "change-me-in-production";
export const SESSION_TIMEOUT_MINUTES = 10;

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

export function signToken(userId: string): string {
  return jwtSign({ sub: userId }, JWT_SECRET, { expiresIn: "7d" });
}

export function verifyToken(token: string): { sub: string } | null {
  try {
    const payload = jwtVerify(token, JWT_SECRET) as { sub: string };
    return payload;
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

export function getSessionExpiration(): Date {
  return new Date(Date.now() + SESSION_TIMEOUT_MINUTES * 60_000);
}

/** Attach user to request from Authorization: Bearer <token> or cookie jwt= */
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

  const session = await prisma.session.findUnique({
    where: { sessionToken: token },
    include: {
      user: {
        select: { id: true, email: true, name: true, image: true, role: true },
      },
    },
  });

  if (!session || !session.user) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  if (session.expires <= new Date()) {
    await prisma.session
      .delete({ where: { sessionToken: token } })
      .catch(() => undefined);
    res.status(401).json({ error: "Session expired" });
    return;
  }

  if (session.user.id !== payload.sub) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }

  await prisma.session.update({
    where: { sessionToken: token },
    data: { expires: getSessionExpiration() },
  });

  req.user = {
    id: session.user.id,
    email: session.user.email,
    name: session.user.name,
    image: session.user.image,
    role: session.user.role,
  };
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
