import {
  Body,
  Controller,
  Get,
  HttpCode,
  Next,
  Post,
  Req,
  Res,
} from "@nestjs/common";
import type { NextFunction, Request, Response } from "express";
import passport from "passport";
import { rethrowOrWrap } from "../common/errors";
import { AuthService } from "./auth.service";
import { TokenService } from "./token.service";

@Controller("auth")
export class AuthController {
  constructor(
    private readonly auth: AuthService,
    private readonly tokens: TokenService,
  ) {}

  @Post("signup")
  @HttpCode(201)
  async signup(@Body() body: Record<string, unknown>) {
    try {
      return await this.auth.signup(body);
    } catch (e) {
      rethrowOrWrap(e, "Failed to create account");
    }
  }

  @Post("login")
  @HttpCode(200)
  async login(@Body() body: Record<string, unknown>) {
    try {
      return await this.auth.login(body);
    } catch (e) {
      rethrowOrWrap(e, "Failed to sign in");
    }
  }

  @Get("google")
  googleStart(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    if (!this.auth.googleOAuthEnabled) {
      res.status(503).json({
        error:
          "Google OAuth is not configured. Add client ID and secret to the API .env file.",
      });
      return;
    }
    passport.authenticate("google", { scope: ["profile", "email"] })(
      req,
      res,
      next,
    );
  }

  @Get("google/callback")
  googleCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    const frontendUrl = this.auth.frontendUrl;
    passport.authenticate(
      "google",
      {
        session: false,
        failureRedirect: `${frontendUrl}/login?error=google`,
      },
      async (err: unknown, user?: { id: string }) => {
        if (err || !user?.id) {
          res.redirect(`${frontendUrl}/login?error=no-user`);
          return;
        }
        const token = await this.auth.createAuthSession(user.id);
        res.redirect(
          `${frontendUrl}/auth/callback?token=${encodeURIComponent(token)}`,
        );
      },
    )(req, res, next);
  }

  @Get("github")
  githubStart(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    if (!this.auth.githubOAuthEnabled) {
      res.status(503).json({
        error:
          "GitHub OAuth is not configured. Add client ID and secret to the API .env file.",
      });
      return;
    }
    passport.authenticate("github", { scope: ["user:email"] })(req, res, next);
  }

  @Get("github/callback")
  githubCallback(
    @Req() req: Request,
    @Res() res: Response,
    @Next() next: NextFunction,
  ) {
    const frontendUrl = this.auth.frontendUrl;
    passport.authenticate(
      "github",
      {
        session: false,
        failureRedirect: `${frontendUrl}/login?error=github`,
      },
      async (err: unknown, user?: { id: string }) => {
        if (err || !user?.id) {
          res.redirect(`${frontendUrl}/login?error=no-user`);
          return;
        }
        const token = await this.auth.createAuthSession(user.id);
        res.redirect(
          `${frontendUrl}/auth/callback?token=${encodeURIComponent(token)}`,
        );
      },
    )(req, res, next);
  }

  @Post("logout")
  @HttpCode(200)
  async logout(@Req() req: Request) {
    return this.auth.logout(this.tokens.getTokenFromRequest(req));
  }

  @Get("setup")
  setup() {
    return this.auth.setup();
  }
}
