import { Router, type Request, type Response, type NextFunction } from "express";
import passport from "passport";
import { signToken } from "../middleware/auth.js";
import { prisma } from "../lib/prisma.js";
import { githubOAuthEnabled, googleOAuthEnabled } from "../config/passport.js";

const router = Router();
const FRONTEND_URL = process.env.FRONTEND_URL ?? "http://localhost:3000";

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

// Serialize user for session (used by Passport in OAuth flow only; we use JWT after)
passport.serializeUser((user: { id: string }, done) => done(null, user.id));
passport.deserializeUser(async (id: string, done) => {
  try {
    const user = await prisma.user.findUnique({ where: { id } });
    done(null, user ?? undefined);
  } catch (e) {
    done(e);
  }
});

// Google OAuth
router.get(
  "/google",
  requireProvider(googleOAuthEnabled, "Google"),
  passport.authenticate("google", { scope: ["profile", "email"] })
);

router.get(
  "/google/callback",
  passport.authenticate("google", { session: false, failureRedirect: `${FRONTEND_URL}/login?error=google` }),
  (req: Request & { user?: { id: string } }, res) => {
    if (!req.user?.id) {
      res.redirect(`${FRONTEND_URL}/login?error=no-user`);
      return;
    }
    const token = signToken(req.user.id);
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`);
  }
);

// GitHub OAuth
router.get(
  "/github",
  requireProvider(githubOAuthEnabled, "GitHub"),
  passport.authenticate("github", { scope: ["user:email"] })
);

router.get(
  "/github/callback",
  passport.authenticate("github", { session: false, failureRedirect: `${FRONTEND_URL}/login?error=github` }),
  (req: Request & { user?: { id: string } }, res) => {
    if (!req.user?.id) {
      res.redirect(`${FRONTEND_URL}/login?error=no-user`);
      return;
    }
    const token = signToken(req.user.id);
    res.redirect(`${FRONTEND_URL}/auth/callback?token=${encodeURIComponent(token)}`);
  }
);

// Logout (client should clear token)
router.post("/logout", (_, res) => {
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
