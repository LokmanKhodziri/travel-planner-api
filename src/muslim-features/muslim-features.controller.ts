import { Controller, Get, Param, Query, UseGuards } from "@nestjs/common";
import { CurrentUser } from "../common/decorators/current-user.decorator";
import { rethrowOrWrap } from "../common/errors";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import type { AuthUser } from "../common/types/auth-user";
import { MuslimFeaturesService } from "./muslim-features.service";

@Controller("api/trips/:tripId")
@UseGuards(JwtAuthGuard)
export class MuslimFeaturesController {
  constructor(private readonly features: MuslimFeaturesService) {}

  @Get("prayer-times")
  async prayerTimes(
    @Param("tripId") tripId: string,
    @CurrentUser() user: AuthUser,
    @Query("date") date?: string,
  ) {
    try {
      return await this.features.prayerTimes(tripId, user.id, date);
    } catch (e) {
      rethrowOrWrap(
        e,
        e instanceof Error ? e.message : "Failed to fetch prayer times",
      );
    }
  }

  @Get("nearby/mosques")
  async nearbyMosques(
    @Param("tripId") tripId: string,
    @CurrentUser() user: AuthUser,
    @Query("radius") radius?: string,
    @Query("latitude") latitude?: string,
    @Query("longitude") longitude?: string,
  ) {
    try {
      return await this.features.nearbyMosques(tripId, user.id, {
        radius,
        latitude,
        longitude,
      });
    } catch (e) {
      rethrowOrWrap(
        e,
        e instanceof Error ? e.message : "Failed to fetch mosques",
      );
    }
  }

  @Get("nearby/halal")
  async nearbyHalal(
    @Param("tripId") tripId: string,
    @CurrentUser() user: AuthUser,
    @Query("radius") radius?: string,
  ) {
    try {
      return await this.features.nearbyHalal(tripId, user.id, radius);
    } catch (e) {
      rethrowOrWrap(
        e,
        e instanceof Error ? e.message : "Failed to fetch Halal restaurants",
      );
    }
  }

  @Get("activity-recommendations")
  async activityRecommendations(
    @Param("tripId") tripId: string,
    @CurrentUser() user: AuthUser,
    @Query("radius") radius?: string,
    @Query("exclude") exclude?: string,
    @Query("extended") extended?: string,
  ) {
    try {
      return await this.features.activityRecommendations(tripId, user.id, {
        radius,
        exclude,
        extended,
      });
    } catch (e) {
      rethrowOrWrap(
        e,
        e instanceof Error
          ? e.message
          : "Failed to fetch activity recommendations",
      );
    }
  }
}
