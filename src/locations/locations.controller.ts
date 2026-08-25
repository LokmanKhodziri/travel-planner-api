import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Query,
  UseGuards,
} from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { rethrowOrWrap } from "../common/errors";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { AuthUser } from "../common/types/auth-user";
import { LocationsService } from "./locations.service";

@Controller("api/locations")
@UseGuards(JwtAuthGuard)
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Get()
  async list(@CurrentUser() user: AuthUser) {
    try {
      return await this.locations.listForUser(user.id);
    } catch (e) {
      rethrowOrWrap(e, "Failed to fetch locations");
    }
  }

  @Patch("reorder")
  async reorder(
    @CurrentUser() user: AuthUser,
    @Body() body: { tripId?: string; locationIds?: string[] },
  ) {
    try {
      return await this.locations.reorder(user.id, body);
    } catch (e) {
      rethrowOrWrap(e, "Failed to reorder locations");
    }
  }

  @Delete(":id")
  async remove(
    @Param("id") id: string,
    @Query("tripId") tripId: string | undefined,
    @CurrentUser() user: AuthUser,
  ) {
    try {
      return await this.locations.remove(id, tripId, user.id);
    } catch (e) {
      rethrowOrWrap(e, "Failed to delete location");
    }
  }
}
