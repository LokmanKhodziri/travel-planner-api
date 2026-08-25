import { Controller, Get, UseGuards } from "@nestjs/common";
import { rethrowOrWrap } from "../common/errors";
import { AdminGuard } from "../common/guards/admin.guard";
import { AdminService } from "./admin.service";

@Controller("api/admin")
@UseGuards(AdminGuard)
export class AdminController {
  constructor(private readonly admin: AdminService) {}

  @Get("summary")
  async summary() {
    try {
      return await this.admin.summary();
    } catch (e) {
      rethrowOrWrap(e, "Failed to load admin summary");
    }
  }

  @Get("users")
  async users() {
    try {
      return await this.admin.users();
    } catch (e) {
      rethrowOrWrap(e, "Failed to load users");
    }
  }

  @Get("trips")
  async trips() {
    try {
      return await this.admin.trips();
    } catch (e) {
      rethrowOrWrap(e, "Failed to load trips");
    }
  }

  @Get("locations")
  async locations() {
    try {
      return await this.admin.locations();
    } catch (e) {
      rethrowOrWrap(e, "Failed to load locations");
    }
  }

  @Get("prayer-facilities")
  async prayerFacilities() {
    try {
      return await this.admin.prayerFacilities();
    } catch (e) {
      rethrowOrWrap(e, "Failed to load prayer facilities");
    }
  }

  @Get("halal-restaurants")
  async halalRestaurants() {
    try {
      return await this.admin.halalRestaurants();
    } catch (e) {
      rethrowOrWrap(e, "Failed to load Halal restaurants");
    }
  }

  @Get("settings")
  settings() {
    return this.admin.settings();
  }
}
