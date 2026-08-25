import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { rethrowOrWrap } from "../common/errors";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { AuthUser } from "../common/types/auth-user";
import { ExpensesService } from "./expenses.service";

@Controller("api/trips/:tripId/expenses")
@UseGuards(JwtAuthGuard)
export class ExpensesController {
  constructor(private readonly expenses: ExpensesService) {}

  @Get()
  async list(@Param("tripId") tripId: string, @CurrentUser() user: AuthUser) {
    try {
      return await this.expenses.list(tripId, user.id);
    } catch (e) {
      rethrowOrWrap(e, "Failed to fetch expenses");
    }
  }

  @Post()
  @HttpCode(201)
  async create(
    @Param("tripId") tripId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      return await this.expenses.create(tripId, user.id, body);
    } catch (e) {
      rethrowOrWrap(e, "Failed to create expense");
    }
  }

  @Patch(":expenseId")
  async update(
    @Param("tripId") tripId: string,
    @Param("expenseId") expenseId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      return await this.expenses.update(tripId, expenseId, user.id, body);
    } catch (e) {
      rethrowOrWrap(e, "Failed to update expense");
    }
  }

  @Delete(":expenseId")
  async remove(
    @Param("tripId") tripId: string,
    @Param("expenseId") expenseId: string,
    @CurrentUser() user: AuthUser,
  ) {
    try {
      return await this.expenses.remove(tripId, expenseId, user.id);
    } catch (e) {
      rethrowOrWrap(e, "Failed to delete expense");
    }
  }
}
