import { Body, Controller, Get, Patch, Post, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { rethrowOrWrap } from "../common/errors";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { AuthUser } from "../common/types/auth-user";
import { MeService } from "./me.service";

@Controller("api/auth/me")
@UseGuards(JwtAuthGuard)
export class MeController {
  constructor(private readonly me: MeService) {}

  @Get()
  async getProfile(@CurrentUser() user: AuthUser) {
    try {
      return await this.me.getProfile(user.id);
    } catch (e) {
      rethrowOrWrap(e, "Failed to load profile");
    }
  }

  @Patch()
  async updateProfile(
    @CurrentUser() user: AuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      return await this.me.updateProfile(user.id, body);
    } catch (e) {
      rethrowOrWrap(e, "Failed to update profile");
    }
  }

  @Post("password")
  async changePassword(
    @CurrentUser() user: AuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      return await this.me.changePassword(user.id, body);
    } catch (e) {
      rethrowOrWrap(e, "Failed to change password");
    }
  }
}
