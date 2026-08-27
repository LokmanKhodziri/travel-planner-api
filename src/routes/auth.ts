import {
  Router,
  type Request,
  type Response,
  type NextFunction,
} from "express";
import passport from "passport";
import {
  getRefreshTokenFromRequest,
  getRefreshExpiration,
  signToken,
  ACCESS_TOKEN_MINUTES,
} from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { githubOAuthEnabled, googleOAuthEnabled } from "../config/passport.js";
import { hashPassword, verifyPassword } from "../services/password.js";
import { generateRefreshToken, hashRefreshToken } from "../services/tokens.js";

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";
const ADMIN_EMAILS = new Set(
  (process.env.ADMIN_EMAILS ?? "admin123@travel.com")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
);

function requireProvider(enabled: boolean, provider: string) {
  return (_req: Request, res: Response, next: NextFunction) => {
    if (!enabled) {
      res.status(503).json({
        error: `${provider} OAuth is not configured. Add client ID and secret to the API .env file.`,
      });
      return;
    }
    next();
  };
}

function normalizeEmail(email: unknown): string | null {
  if (typeof email !== "string") return null;
  const normalized = email.trim().toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized) ? normalized : null;
}

function validatePassword(password: unknown): string | null {
  if (typeof password !== "string") return null;
  return password.length >= 8 ? password : null;
}

interface AuthSession {
  accessToken: string;
  refreshToken: string;
}

async function createAuthSession(userId: string): Promise<AuthSession> {
  const accessToken = signToken(userId);
  const refreshToken = generateRefreshToken();
  await prisma.session.create({
    data: {
      refreshTokenHash: hashRefreshToken(refreshToken),
      userId,
      expires: getRefreshExpiration(),
    },
  });
  return { accessToken, refreshToken };
}

function authResponse(session: AuthSession, user: unknown) {
  return {
    token: session.accessToken,
    refreshToken: session.refreshToken,
    expiresIn: ACCESS_TOKEN_MINUTES * 60,
    user,
  };
}

function oauthRedirectUrl(session: AuthSession): string {
  const hash = new URLSearchParams({
    token: session.accessToken,
    refresh: session.refreshToken,
  });
  return `${FRONTEND_URL}/auth/callback#${hash.toString()}`;
}

function roleForEmail(email: string): "USER" | "ADMIN" {
  return ADMIN_EMAILS.has(email) ? "ADMIN" : "USER";
}

// Serialize user for session (used by Passport in OAuth flow only; we use JWT after)
passport.serializeUser(
  (user: { id: string }, done: (err: unknown, id?: string) => void) =>
    done(null, user.id),
);
passport.deserializeUser(async (id: string, done: (err: unknown, user?: unknown) => void) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user ?? undefined);
  } catch (e) {
    done(e);
  }
});

// Email/password sign-up
router.post("/signup", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = validatePassword(req.body?.password);
    const name =
      typeof req.body?.name === "string" && req.body.name.trim()
        ? req.body.name.trim()
        : null;

    if (!email || !password) {
      res.status(400).json({
        error: "Valid email and password with at least 8 characters are required",
      });
      return;
    }

    const existingUser = await prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      res.status(409).json({ error: "An account with this email already exists" });
      return;
    }

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await hashPassword(password),
        role: roleForEmail(email),
      },
      select: { id: true, email: true, name: true, image: true, role: true },
    });

    const session = await createAuthSession(user.id);
    res.status(201).json(authResponse(session, user));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to create account" });
  }
});

// Email/password sign-in
router.post("/login", async (req: Request, res: Response) => {
  try {
    const email = normalizeEmail(req.body?.email);
    const password = validatePassword(req.body?.password);

    if (!email || !password) {
      res.status(400).json({ error: "Valid email and password are required" });
      return;
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const validPassword = await verifyPassword(password, user.passwordHash);
    if (!validPassword) {
      res.status(401).json({ error: "Invalid email or password" });
      return;
    }

    const session = await createAuthSession(user.id);
    res.json(
      authResponse(session, {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      }),
    );
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to sign in" });
  }
});

// Google OAuth
router.get(
  "/google",
  requireProvider(googleOAuthEnabled, "Google"),
  passport.authenticate("google", { scope: ["profile", "email"] }),
);

router.get(
  "/google/callback",
  passport.authenticate("google", {
    session: false,
    failureRedirect: `${FRONTEND_URL}/login?error=google`,
  }),
  async (req: Request & { user?: { id: string } }, res) => {
    if (!req.user?.id) {
      res.redirect(`${FRONTEND_URL}/login?error=no-user`);
      return;
    }
    const session = await createAuthSession(req.user.id);
    res.redirect(oauthRedirectUrl(session));
  },
);

// GitHub OAuth
router.get(
  "/github",
  requireProvider(githubOAuthEnabled, "GitHub"),
  passport.authenticate("github", { scope: ["user:email"] }),
);

router.get(
  "/github/callback",
  passport.authenticate("github", {
    session: false,
    failureRedirect: `${FRONTEND_URL}/login?error=github`,
  }),
  async (req: Request & { user?: { id: string } }, res) => {
    if (!req.user?.id) {
      res.redirect(`${FRONTEND_URL}/login?error=no-user`);
      return;
    }
    const session = await createAuthSession(req.user.id);
    res.redirect(oauthRedirectUrl(session));
  },
);

// Rotate refresh token and issue a new access JWT
router.post("/refresh", async (req: Request, res: Response) => {
  try {
    const refreshToken = getRefreshTokenFromRequest(req);
    if (!refreshToken) {
      res.status(401).json({ error: "Refresh token required" });
      return;
    }

    const existing = await prisma.session.findUnique({
      where: { refreshTokenHash: hashRefreshToken(refreshToken) },
      include: {
        user: {
          select: { id: true, email: true, name: true, image: true, role: true },
        },
      },
    });

    if (!existing || existing.expires <= new Date() || !existing.user) {
      if (existing) {
        await prisma.session
          .delete({ where: { id: existing.id } })
          .catch(() => undefined);
      }
      res.status(401).json({ error: "Invalid or expired refresh token" });
      return;
    }

    const nextSession = await createAuthSession(existing.user.id);
    await prisma.session.delete({ where: { id: existing.id } }).catch(() => undefined);

    res.json(authResponse(nextSession, existing.user));
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to refresh session" });
  }
});

// Logout (revoke this device's refresh session)
router.post("/logout", async (req: Request, res) => {
  const refreshToken = getRefreshTokenFromRequest(req);
  if (refreshToken) {
    await prisma.session.deleteMany({
      where: { refreshTokenHash: hashRefreshToken(refreshToken) },
    });
  }

  res.status(200).json({ ok: true });
});

// Dev helper: exact OAuth callback URLs to register in Google/GitHub consoles
router.get("/setup", (_, res) => {
  const apiUrl = process.env.API_URL ?? "http://localhost:4000";
  res.json({
    apiUrl,
    frontendUrl: FRONTEND_URL,
    google: {
      enabled: googleOAuthEnabled,
      registerRedirectUri: `${apiUrl}/auth/google/callback`,
      startLoginUrl: `${apiUrl}/auth/google`,
    },
    github: {
      enabled: githubOAuthEnabled,
      registerCallbackUrl: `${apiUrl}/auth/github/callback`,
      startLoginUrl: `${apiUrl}/auth/github`,
    },
    note: "Register the redirect/callback URLs exactly as shown (no trailing slash). Restart API after changing .env.",
  });
});

export default router;
