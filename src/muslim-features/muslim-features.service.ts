import { Injectable } from "@nestjs/common";
import { resolveTripCoordinates } from "../common/geo";
import { throwApiError } from "../common/errors";
import { AladhanService } from "../integrations/aladhan.service";
import { PlacesService } from "../integrations/places.service";
import { TripUtilsService } from "../trips/trip-utils.service";

function requireDate(value: unknown): string | null {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return null;
  }
  return value;
}

@Injectable()
export class MuslimFeaturesService {
  constructor(
    private readonly tripUtils: TripUtilsService,
    private readonly aladhan: AladhanService,
    private readonly places: PlacesService,
  ) {}

  private async getTripCoords(tripId: string, userId: string) {
    const trip = await this.tripUtils.getOwnedTrip(tripId, userId);
    if (!trip) throwApiError("Trip not found", 404);

    const coords = resolveTripCoordinates(trip);
    if (!coords) {
      throwApiError(
        "Add at least one location to this trip before using Muslim-friendly features.",
        400,
      );
    }
    return { trip, coords };
  }

  async prayerTimes(tripId: string, userId: string, dateQuery: unknown) {
    const date = requireDate(dateQuery);
    if (!date) throwApiError("date query required (YYYY-MM-DD)", 400);
    const context = await this.getTripCoords(tripId, userId);
    return this.aladhan.getPrayerTimings(
      context.coords.latitude,
      context.coords.longitude,
      date,
    );
  }

  async nearbyMosques(
    tripId: string,
    userId: string,
    query: { radius?: string; latitude?: string; longitude?: string },
  ) {
    const context = await this.getTripCoords(tripId, userId);
    const queryLat = Number(query.latitude);
    const queryLng = Number(query.longitude);
    const latitude = Number.isFinite(queryLat)
      ? queryLat
      : context.coords.latitude;
    const longitude = Number.isFinite(queryLng)
      ? queryLng
      : context.coords.longitude;
    const radius = Number(query.radius) || 5000;
    return this.places.findNearbyMosques(latitude, longitude, radius);
  }

  async nearbyHalal(tripId: string, userId: string, radiusQuery?: string) {
    const context = await this.getTripCoords(tripId, userId);
    const radius = Number(radiusQuery) || 5000;
    return this.places.findNearbyHalal(
      context.coords.latitude,
      context.coords.longitude,
      radius,
    );
  }

  async activityRecommendations(
    tripId: string,
    userId: string,
    query: { radius?: string; exclude?: string; extended?: string },
  ) {
    const trip = await this.tripUtils.getOwnedTrip(tripId, userId);
    if (!trip) throwApiError("Trip not found", 404);
    if (trip.locations.length === 0) {
      throwApiError(
        "Add at least one location to this trip before getting recommendations.",
        400,
      );
    }

    const radius = Number(query.radius) || 5000;
    const excludeIds =
      typeof query.exclude === "string" && query.exclude.trim()
        ? query.exclude.split(",").map((id) => id.trim()).filter(Boolean)
        : [];
    const extended = query.extended === "true" || query.extended === "1";
    const rows = await Promise.all(
      trip.locations.slice(0, 5).map(async (location) => {
        try {
          const recommendations = await this.places.findNearbyActivities(
            location.latitude,
            location.longitude,
            radius,
            { excludeIds, extended },
          );
          return {
            sourceLocation: {
              id: location.id,
              title: location.locationTitle,
              latitude: location.latitude,
              longitude: location.longitude,
            },
            recommendations,
            error: null,
          };
        } catch (e) {
          return {
            sourceLocation: {
              id: location.id,
              title: location.locationTitle,
              latitude: location.latitude,
              longitude: location.longitude,
            },
            recommendations: [],
            error: (e as Error).message,
          };
        }
      }),
    );

    return {
      radius,
      source: "Google Places live search",
      note: "Recommendations are based on your saved trip locations. Places already in your itinerary are hidden automatically.",
      rows,
    };
  }
}
