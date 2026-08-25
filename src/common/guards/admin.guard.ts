import { CanActivate, ExecutionContext, Injectable } from "@nestjs/common";
import type { Request } from "express";
import { throwApiError } from "../errors";
import type { AuthUser } from "../types/auth-user";
import { JwtAuthGuard } from "./jwt-auth.guard";

@Injectable()
export class AdminGuard implements CanActivate {
  constructor(private readonly jwtAuthGuard: JwtAuthGuard) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    await this.jwtAuthGuard.canActivate(context);
    const req = context
      .switchToHttp()
      .getRequest<Request & { user?: AuthUser }>();
    if (req.user?.role !== "ADMIN") {
      throwApiError("Admin access required", 403);
    }
    return true;
  }
}
