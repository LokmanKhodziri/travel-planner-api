import passport from "passport";
import { Strategy as GoogleStrategy } from "passport-google-oauth20";
import { Strategy as GitHubStrategy } from "passport-github2";
import { prisma } from "../lib/prisma.js";

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID ?? "";
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET ?? "";
const GITHUB_CLIENT_ID = process.env.GITHUB_CLIENT_ID ?? "";
const GITHUB_CLIENT_SECRET = process.env.GITHUB_CLIENT_SECRET ?? "";
const API_URL = process.env.API_URL ?? "http://localhost:4000";

export const googleOAuthEnabled = Boolean(GOOGLE_CLIENT_ID && GOOGLE_CLIENT_SECRET);
export const githubOAuthEnabled = Boolean(GITHUB_CLIENT_ID && GITHUB_CLIENT_SECRET);

if (googleOAuthEnabled) {
  passport.use(
    new GoogleStrategy(
      {
        clientID: GOOGLE_CLIENT_ID,
        clientSecret: GOOGLE_CLIENT_SECRET,
        callbackURL: `${API_URL}/auth/google/callback`,
      },
      async (_accessToken, _refreshToken, profile, done) => {
        try {
          const email = profile.emails?.[0]?.value;
          if (!email) return done(new Error("No email from Google"));
          let user = await prisma.user.findUnique({ where: { email } });
          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                name: profile.displayName ?? null,
                image: profile.photos?.[0]?.value ?? null,
              },
            });
          }
          return done(null, { id: user.id });
        } catch (e) {
          return done(e as Error);
        }
      }
    )
  );
} else {
  console.warn("Google OAuth disabled: set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env");
}

if (githubOAuthEnabled) {
  passport.use(
    new GitHubStrategy(
      {
        clientID: GITHUB_CLIENT_ID,
        clientSecret: GITHUB_CLIENT_SECRET,
        callbackURL: `${API_URL}/auth/github/callback`,
      },
      async (
        _accessToken: string,
        _refreshToken: string,
        profile: {
          id: string;
          displayName?: string;
          photos?: { value: string }[];
          emails?: { value: string }[];
        },
        done: (err: Error | null, user?: { id: string }) => void
      ) => {
        try {
          const email = profile.emails?.[0]?.value ?? `${profile.id}@github.user`;
          let user = await prisma.user.findUnique({ where: { email } });
          if (!user) {
            user = await prisma.user.create({
              data: {
                email,
                name: profile.displayName ?? null,
                image: profile.photos?.[0]?.value ?? null,
              },
            });
          }
          return done(null, { id: user.id });
        } catch (e) {
          return done(e as Error);
        }
      }
    )
  );
} else {
  console.warn("GitHub OAuth disabled: set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET in .env");
}
