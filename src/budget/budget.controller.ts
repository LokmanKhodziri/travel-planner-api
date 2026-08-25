import { Body, Controller, Delete, Get, Param, Put, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { rethrowOrWrap } from "../common/errors";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { AuthUser } from "../common/types/auth-user";
import { BudgetService } from "./budget.service";

@Controller("api/trips/:tripId/budget")
@UseGuards(JwtAuthGuard)
export class BudgetController {
  constructor(private readonly budget: BudgetService) {}

  @Get()
  async get(@Param("tripId") tripId: string, @CurrentUser() user: AuthUser) {
    try {
      return await this.budget.get(tripId, user.id);
    } catch (e) {
      rethrowOrWrap(e, "Failed to fetch budget");
    }
  }

  @Put()
  async upsert(
    @Param("tripId") tripId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      return await this.budget.upsert(tripId, user.id, body);
    } catch (e) {
      rethrowOrWrap(e, "Failed to save budget");
    }
  }

  @Delete()
  async clear(@Param("tripId") tripId: string, @CurrentUser() user: AuthUser) {
    try {
      return await this.budget.clear(tripId, user.id);
    } catch (e) {
      rethrowOrWrap(e, "Failed to clear budget");
    }
  }
}
