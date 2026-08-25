import { Injectable, OnModuleInit } from "@nestjs/common";
import passport from "passport";
import { PrismaService } from "../prisma/prisma.service";
import { throwApiError } from "../common/errors";
import { normalizeEmail, roleForEmail, validatePassword } from "../common/validation";
import { PasswordService } from "./password.service";
import { TokenService } from "./token.service";

@Injectable()
export class AuthService implements OnModuleInit {
  constructor(
    private readonly prisma: PrismaService,
    private readonly passwords: PasswordService,
    private readonly tokens: TokenService,
  ) {}

  get googleOAuthEnabled() {
    return Boolean(
      process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET,
    );
  }

  get githubOAuthEnabled() {
    return Boolean(
      process.env.GITHUB_CLIENT_ID && process.env.GITHUB_CLIENT_SECRET,
    );
  }

  get frontendUrl() {
    return process.env.FRONTEND_URL ?? "http://localhost:3000";
  }

  onModuleInit() {
    passport.serializeUser(
      (user: { id: string }, done: (err: unknown, id?: string) => void) =>
        done(null, user.id),
    );
    passport.deserializeUser(
      async (id: string, done: (err: unknown, user?: unknown) => void) => {
        try {
          const user = await this.prisma.user.findUnique({ where: { id } });
          done(null, user ?? undefined);
        } catch (e) {
          done(e);
        }
      },
    );
  }

  async createAuthSession(userId: string): Promise<string> {
    const token = this.tokens.sign(userId);
    await this.prisma.session.create({
      data: {
        sessionToken: token,
        userId,
        expires: this.tokens.getSessionExpiration(),
      },
    });
    return token;
  }

  async signup(body: { email?: unknown; password?: unknown; name?: unknown }) {
    const email = normalizeEmail(body?.email);
    const password = validatePassword(body?.password);
    const name =
      typeof body?.name === "string" && body.name.trim()
        ? body.name.trim()
        : null;

    if (!email || !password) {
      throwApiError(
        "Valid email and password with at least 8 characters are required",
        400,
      );
    }

    const existingUser = await this.prisma.user.findUnique({ where: { email } });
    if (existingUser) {
      throwApiError("An account with this email already exists", 409);
    }

    const user = await this.prisma.user.create({
      data: {
        email,
        name,
        passwordHash: await this.passwords.hash(password),
        role: roleForEmail(email),
      },
      select: { id: true, email: true, name: true, image: true, role: true },
    });

    const token = await this.createAuthSession(user.id);
    return { token, user };
  }

  async login(body: { email?: unknown; password?: unknown }) {
    const email = normalizeEmail(body?.email);
    const password = validatePassword(body?.password);

    if (!email || !password) {
      throwApiError("Valid email and password are required", 400);
    }

    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user?.passwordHash) {
      throwApiError("Invalid email or password", 401);
    }

    const validPassword = await this.passwords.verify(
      password,
      user.passwordHash,
    );
    if (!validPassword) {
      throwApiError("Invalid email or password", 401);
    }

    const token = await this.createAuthSession(user.id);
    return {
      token,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        image: user.image,
        role: user.role,
      },
    };
  }

  async logout(token: string | null) {
    if (token) {
      await this.prisma.session.deleteMany({ where: { sessionToken: token } });
    }
    return { ok: true };
  }

  setup() {
    const apiUrl = process.env.API_URL ?? "http://localhost:4000";
    return {
      apiUrl,
      frontendUrl: this.frontendUrl,
      google: {
        enabled: this.googleOAuthEnabled,
        registerRedirectUri: `${apiUrl}/auth/google/callback`,
        startLoginUrl: `${apiUrl}/auth/google`,
      },
      github: {
        enabled: this.githubOAuthEnabled,
        registerCallbackUrl: `${apiUrl}/auth/github/callback`,
        startLoginUrl: `${apiUrl}/auth/github`,
      },
      note: "Register the redirect/callback URLs exactly as shown (no trailing slash). Restart API after changing .env.",
    };
  }
}
