import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { rethrowOrWrap } from "../common/errors";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { AuthUser } from "../common/types/auth-user";
import { ActivitiesService } from "./activities.service";

@Controller("api/trips/:tripId/activities")
@UseGuards(JwtAuthGuard)
export class ActivitiesController {
  constructor(private readonly activities: ActivitiesService) {}

  @Get()
  async list(
    @Param("tripId") tripId: string,
    @CurrentUser() user: AuthUser,
  ) {
    try {
      return await this.activities.list(tripId, user.id);
    } catch (e) {
      rethrowOrWrap(e, "Failed to fetch activities");
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
      return await this.activities.create(tripId, user.id, body);
    } catch (e) {
      rethrowOrWrap(e, "Failed to create activity");
    }
  }

  @Get("travel-times")
  async travelTimes(
    @Param("tripId") tripId: string,
    @CurrentUser() user: AuthUser,
    @Query("date") date?: string,
    @Query("mode") mode?: string,
    @Query("order") order?: string,
  ) {
    try {
      return await this.activities.travelTimes(tripId, user.id, {
        date,
        mode,
        order,
      });
    } catch (e) {
      rethrowOrWrap(e, "Failed to fetch travel times");
    }
  }

  @Patch(":activityId")
  async update(
    @Param("tripId") tripId: string,
    @Param("activityId") activityId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      return await this.activities.update(tripId, activityId, user.id, body);
    } catch (e) {
      rethrowOrWrap(e, "Failed to update activity");
    }
  }

  @Delete(":activityId")
  async remove(
    @Param("tripId") tripId: string,
    @Param("activityId") activityId: string,
    @CurrentUser() user: AuthUser,
  ) {
    try {
      return await this.activities.remove(tripId, activityId, user.id);
    } catch (e) {
      rethrowOrWrap(e, "Failed to delete activity");
    }
  }
}
