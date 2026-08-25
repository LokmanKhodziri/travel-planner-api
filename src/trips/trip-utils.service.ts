import { Injectable } from "@nestjs/common";
import { distanceMeters } from "../common/geo";
import { GeocodeService } from "../integrations/geocode.service";
import { PrismaService } from "../prisma/prisma.service";

export interface EnsureTripLocationInput {
  locationTitle: string;
  address?: string | null;
  latitude?: number | null;
  longitude?: number | null;
}

type TripLocationRecord = {
  id: string;
  locationTitle: string;
  latitude: number;
  longitude: number;
  order: number;
  tripId: string;
  createAt: Date;
  updateAt: Date | null;
};

@Injectable()
export class TripUtilsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly geocode: GeocodeService,
  ) {}

  async getOwnedTrip(tripId: string, userId: string) {
    return this.prisma.trip.findFirst({
      where: { id: tripId, userId },
      include: {
        locations: { orderBy: { order: "asc" } },
        activities: { orderBy: { startTime: "asc" } },
      },
    });
  }

  async syncTripDestinationFromLocation(
    tripId: string,
    latitude: number,
    longitude: number,
    locationTitle: string,
  ) {
    const trip = await this.prisma.trip.findUnique({ where: { id: tripId } });
    if (!trip || trip.destinationLat != null) return;

    await this.prisma.trip.update({
      where: { id: tripId },
      data: {
        destinationCity: locationTitle,
        destinationLat: latitude,
        destinationLng: longitude,
      },
    });
  }

  async ensureTripLocation(
    tripId: string,
    input: EnsureTripLocationInput,
    existingLocations?: TripLocationRecord[],
  ): Promise<TripLocationRecord | null> {
    const trimmedTitle = input.locationTitle.trim();
    if (!trimmedTitle) return null;

    const trimmedAddress = input.address?.trim() || trimmedTitle;
    let lat = input.latitude ?? null;
    let lng = input.longitude ?? null;

    if (lat == null || lng == null) {
      if (!trimmedAddress) return null;
      try {
        const geocoded = await this.geocode.geocodeAddress(trimmedAddress);
        lat = geocoded.latitude;
        lng = geocoded.longitude;
      } catch {
        return null;
      }
    }

    const locations =
      existingLocations ??
      (await this.prisma.location.findMany({
        where: { tripId },
        orderBy: { order: "asc" },
      }));

    const duplicate = locations.find(
      (loc) => distanceMeters(loc.latitude, loc.longitude, lat!, lng!) < 150,
    );
    if (duplicate) return duplicate;

    const location = await this.prisma.location.create({
      data: {
        locationTitle: trimmedTitle,
        tripId,
        latitude: lat,
        longitude: lng,
        order: locations.length,
      },
    });
    await this.syncTripDestinationFromLocation(tripId, lat, lng, trimmedTitle);
    return location;
  }

  async syncTripLocationsFromActivities(tripId: string, userId: string) {
    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, userId },
      include: {
        locations: { orderBy: { order: "asc" } },
        activities: { orderBy: { startTime: "asc" } },
      },
    });
    if (!trip) return null;

    let locations = [...trip.locations];
    for (const activity of trip.activities) {
      const hasCoords = activity.latitude != null && activity.longitude != null;
      const hasAddress = Boolean(activity.address?.trim());
      if (!hasCoords && !hasAddress) continue;

      const synced = await this.ensureTripLocation(
        tripId,
        {
          locationTitle: activity.title,
          address: activity.address,
          latitude: activity.latitude,
          longitude: activity.longitude,
        },
        locations,
      );
      if (synced && !locations.some((loc) => loc.id === synced.id)) {
        locations = [...locations, synced].sort((a, b) => a.order - b.order);
      }
    }

    return locations;
  }
}
