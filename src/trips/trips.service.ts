import { Injectable } from "@nestjs/common";
import { throwApiError } from "../common/errors";
import type { AuthUser } from "../common/types/auth-user";
import { GeocodeService } from "../integrations/geocode.service";
import { PrismaService } from "../prisma/prisma.service";
import { TripUtilsService } from "./trip-utils.service";

@Injectable()
export class TripsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tripUtils: TripUtilsService,
    private readonly geocode: GeocodeService,
  ) {}

  list(userId: string) {
    return this.prisma.trip.findMany({
      where: { userId },
      orderBy: { startDate: "desc" },
    });
  }

  async getById(id: string, user: AuthUser) {
    const trip = await this.prisma.trip.findFirst({
      where: {
        id,
        ...(user.role === "ADMIN" ? {} : { userId: user.id }),
      },
      include: {
        locations: { orderBy: { order: "asc" } },
        activities: { orderBy: { startTime: "asc" } },
      },
    });
    if (!trip) throwApiError("Trip not found", 404);
    return trip;
  }

  async create(
    userId: string,
    body: {
      title?: string;
      description?: string;
      imageUrl?: string;
      startDate?: string;
      endDate?: string;
    },
  ) {
    const { title, description, imageUrl, startDate, endDate } = body;
    if (!title || !description || !startDate || !endDate) {
      throwApiError(
        "title, description, startDate, endDate required",
        400,
      );
    }
    return this.prisma.trip.create({
      data: {
        title,
        description,
        imageUrl: imageUrl ?? null,
        startDate: new Date(startDate),
        endDate: new Date(endDate),
        userId,
      },
    });
  }

  async remove(id: string, user: AuthUser) {
    const trip = await this.prisma.trip.findFirst({
      where: {
        id,
        ...(user.role === "ADMIN" ? {} : { userId: user.id }),
      },
    });
    if (!trip) throwApiError("Trip not found", 404);

    await this.prisma.$transaction([
      this.prisma.location.deleteMany({ where: { tripId: id } }),
      this.prisma.trip.delete({ where: { id } }),
    ]);
    return { success: true };
  }

  async syncLocationsFromActivities(tripId: string, userId: string) {
    const locations = await this.tripUtils.syncTripLocationsFromActivities(
      tripId,
      userId,
    );
    if (!locations) throwApiError("Trip not found", 404);
    return locations;
  }

  async addLocation(
    tripId: string,
    userId: string,
    body: {
      address?: string;
      locationTitle?: string;
      latitude?: number;
      longitude?: number;
    },
  ) {
    const { address, locationTitle, latitude, longitude } = body;
    const hasCoords =
      typeof latitude === "number" &&
      typeof longitude === "number" &&
      !Number.isNaN(latitude) &&
      !Number.isNaN(longitude);

    if (!address && !hasCoords) {
      throwApiError("address or latitude/longitude required", 400);
    }

    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, userId },
      include: { locations: true },
    });
    if (!trip) throwApiError("Trip not found", 404);

    let resolvedLat = latitude;
    let resolvedLng = longitude;
    const resolvedTitle =
      (typeof locationTitle === "string" && locationTitle.trim()) ||
      (typeof address === "string" && address.trim()) ||
      "Location";

    if (!hasCoords) {
      const geocoded = await this.geocode.geocodeAddress(address as string);
      resolvedLat = geocoded.latitude;
      resolvedLng = geocoded.longitude;
    }

    const location = await this.tripUtils.ensureTripLocation(
      tripId,
      {
        locationTitle: resolvedTitle,
        address,
        latitude: resolvedLat,
        longitude: resolvedLng,
      },
      trip.locations,
    );
    if (!location) {
      throwApiError("Could not resolve location coordinates", 400);
    }

    const isNew = !trip.locations.some((loc) => loc.id === location.id);
    return { location, status: isNew ? 201 : 200 };
  }
}
