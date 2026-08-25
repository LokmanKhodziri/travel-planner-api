import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
  Res,
  UseGuards,
} from "@nestjs/common";
import type { Response } from "express";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { rethrowOrWrap } from "../common/errors";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { AuthUser } from "../common/types/auth-user";
import { TripsService } from "./trips.service";

@Controller("api/trips")
@UseGuards(JwtAuthGuard)
export class TripsController {
  constructor(private readonly trips: TripsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    try {
      return await this.trips.list(user.id);
    } catch (e) {
      rethrowOrWrap(e, "Failed to fetch trips");
    }
  }

  @Get(":id")
  async getById(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    try {
      return await this.trips.getById(id, user);
    } catch (e) {
      rethrowOrWrap(e, "Failed to fetch trip");
    }
  }

  @Post()
  @HttpCode(201)
  async create(
    @CurrentUser() user: AuthUser,
    @Body() body: Record<string, unknown>,
  ) {
    try {
      return await this.trips.create(user.id, body as never);
    } catch (e) {
      rethrowOrWrap(e, "Failed to create trip");
    }
  }

  @Delete(":id")
  async remove(@Param("id") id: string, @CurrentUser() user: AuthUser) {
    try {
      return await this.trips.remove(id, user);
    } catch (e) {
      rethrowOrWrap(e, "Failed to delete trip");
    }
  }

  @Post(":tripId/locations/sync-from-activities")
  async syncFromActivities(
    @Param("tripId") tripId: string,
    @CurrentUser() user: AuthUser,
  ) {
    try {
      return await this.trips.syncLocationsFromActivities(tripId, user.id);
    } catch (e) {
      rethrowOrWrap(e, "Failed to sync locations from activities");
    }
  }

  @Post(":tripId/locations")
  async addLocation(
    @Param("tripId") tripId: string,
    @CurrentUser() user: AuthUser,
    @Body() body: Record<string, unknown>,
    @Res({ passthrough: true }) res: Response,
  ) {
    try {
      const result = await this.trips.addLocation(tripId, user.id, body as never);
      res.status(result.status);
      return result.location;
    } catch (e) {
      rethrowOrWrap(e, "Failed to add location");
    }
  }
}
