import { Controller, Get, Query, UseGuards } from "@nestjs/common";
import { throwApiError, rethrowOrWrap } from "../common/errors";
import { JwtAuthGuard } from "../common/guards/jwt-auth.guard";
import { PlacesService } from "../integrations/places.service";

@Controller("api/places")
@UseGuards(JwtAuthGuard)
export class PlacesController {
  constructor(private readonly places: PlacesService) {}

  @Get("search")
  async search(@Query("input") inputQuery?: string) {
    const input = typeof inputQuery === "string" ? inputQuery.trim() : "";
    if (!input) throwApiError("input query required", 400);
    try {
      return await this.places.searchPlaces(input);
    } catch (e) {
      rethrowOrWrap(
        e,
        e instanceof Error ? e.message : "Failed to load place suggestions",
      );
    }
  }
}
