import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { throwApiError } from "../errors";
import type { AuthUser } from "../types/auth-user";
import { PrismaService } from "../../prisma/prisma.service";
import { TokenService } from "../../auth/token.service";

@Injectable()
export class JwtAuthGuard implements CanActivate {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tokens: TokenService,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest<Request & { user?: AuthUser }>();
    const token = this.tokens.getTokenFromRequest(req);

    if (!token) {
      throwApiError("Unauthorized", 401);
    }

    const payload = this.tokens.verify(token);
    if (!payload) {
      throwApiError("Invalid or expired token", 401);
    }

    const session = await this.prisma.session.findUnique({
      where: { sessionToken: token },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            image: true,
            role: true,
          },
        },
      },
    });

    if (!session || !session.user) {
      throwApiError("Unauthorized", 401);
    }

    if (session.expires <= new Date()) {
      await this.prisma.session
        .delete({ where: { sessionToken: token } })
        .catch(() => undefined);
      throwApiError("Session expired", 401);
    }

    if (session.user.id !== payload.sub) {
      throwApiError("Unauthorized", 401);
    }

    await this.prisma.session.update({
      where: { sessionToken: token },
      data: { expires: this.tokens.getSessionExpiration() },
    });

    req.user = {
      id: session.user.id,
      email: session.user.email,
      name: session.user.name,
      image: session.user.image,
      role: session.user.role,
    };
    return true;
  }
}
