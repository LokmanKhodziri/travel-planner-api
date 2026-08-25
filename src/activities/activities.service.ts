import { Injectable } from "@nestjs/common";
import { throwApiError } from "../common/errors";
import {
  DistanceMatrixService,
  parseTravelMode,
} from "../integrations/distance-matrix.service";
import { GeocodeService } from "../integrations/geocode.service";
import { PrismaService } from "../prisma/prisma.service";
import { TripUtilsService } from "../trips/trip-utils.service";

function parseOptionalCoordinate(value: unknown) {
  if (value == null || value === "") return null;
  const coordinate = Number(value);
  return Number.isFinite(coordinate) ? coordinate : null;
}

function activityDateKey(activity: { startTime: Date }) {
  return activity.startTime.toISOString().slice(0, 10);
}

@Injectable()
export class ActivitiesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly tripUtils: TripUtilsService,
    private readonly geocode: GeocodeService,
    private readonly distanceMatrix: DistanceMatrixService,
  ) {}

  list(tripId: string, userId: string) {
    return this.prisma.itineraryActivity.findMany({
      where: { tripId, trip: { userId } },
      orderBy: { startTime: "asc" },
    });
  }

  async create(tripId: string, userId: string, body: Record<string, unknown>) {
    const { title, description, startTime, endTime, address } = body;
    const latitude = parseOptionalCoordinate(body.latitude);
    const longitude = parseOptionalCoordinate(body.longitude);

    if (!title || !startTime || !endTime) {
      throwApiError("title, startTime and endTime are required", 400);
    }

    const start = new Date(String(startTime));
    const end = new Date(String(endTime));
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime()) || end <= start) {
      throwApiError("Invalid activity time range", 400);
    }

    const trip = await this.prisma.trip.findFirst({
      where: { id: tripId, userId },
    });
    if (!trip) throwApiError("Trip not found", 404);

    let resolvedLatitude = latitude;
    let resolvedLongitude = longitude;
    const trimmedAddress = typeof address === "string" ? address.trim() : "";

    if (
      trimmedAddress &&
      (resolvedLatitude == null || resolvedLongitude == null)
    ) {
      try {
        const geocoded = await this.geocode.geocodeAddress(trimmedAddress);
        resolvedLatitude = geocoded.latitude;
        resolvedLongitude = geocoded.longitude;
      } catch (geocodeError) {
        console.error(geocodeError);
      }
    }

    const count = await this.prisma.itineraryActivity.count({ where: { tripId } });
    const activity = await this.prisma.itineraryActivity.create({
      data: {
        title: String(title),
        description: (description as string | null) ?? null,
        address: trimmedAddress || null,
        latitude: resolvedLatitude,
        longitude: resolvedLongitude,
        startTime: start,
        endTime: end,
        order: count,
        tripId,
      },
    });

    const syncedLocation = await this.tripUtils.ensureTripLocation(tripId, {
      locationTitle: String(title),
      address: trimmedAddress || null,
      latitude: resolvedLatitude,
      longitude: resolvedLongitude,
    });

    return { ...activity, syncedLocation };
  }

  async travelTimes(
    tripId: string,
    userId: string,
    query: { date?: string; mode?: string; order?: string },
  ) {
    const date = typeof query.date === "string" ? query.date : null;
    const preferredMode = parseTravelMode(query.mode);
    const orderParam =
      typeof query.order === "string" ? query.order.trim() : "";

    const activities = await this.prisma.itineraryActivity.findMany({
      where: { tripId, trip: { userId } },
      orderBy: { startTime: "asc" },
    });
    let dayActivities = date
      ? activities.filter((activity) => activityDateKey(activity) === date)
      : activities;

    if (orderParam) {
      const orderIds = orderParam.split(",").map((id) => id.trim()).filter(Boolean);
      const byId = new Map(dayActivities.map((activity) => [activity.id, activity]));
      dayActivities = orderIds
        .map((id) => byId.get(id))
        .filter((activity): activity is (typeof dayActivities)[number] =>
          Boolean(activity),
        );
    }

    const segments = await Promise.all(
      dayActivities.slice(0, -1).map(async (fromActivity, index) => {
        const toActivity = dayActivities[index + 1];
        const baseSegment = {
          fromActivityId: fromActivity.id,
          fromTitle: fromActivity.title,
          toActivityId: toActivity.id,
          toTitle: toActivity.title,
        };

        if (
          fromActivity.latitude == null ||
          fromActivity.longitude == null ||
          toActivity.latitude == null ||
          toActivity.longitude == null
        ) {
          return {
            ...baseSegment,
            estimate: null,
            error:
              "Travel time needs coordinates. Add activities from recommendations to calculate it.",
          };
        }

        try {
          const estimate = await this.distanceMatrix.getSmartTravelEstimate(
            {
              latitude: fromActivity.latitude,
              longitude: fromActivity.longitude,
            },
            {
              latitude: toActivity.latitude,
              longitude: toActivity.longitude,
            },
            preferredMode,
          );
          return { ...baseSegment, estimate, error: null };
        } catch (e) {
          return {
            ...baseSegment,
            estimate: null,
            error: (e as Error).message,
          };
        }
      }),
    );

    return { date, mode: preferredMode, segments };
  }

  async update(
    tripId: string,
    activityId: string,
    userId: string,
    body: Record<string, unknown>,
  ) {
    const { title, description, startTime, endTime, address } = body;
    const existing = await this.prisma.itineraryActivity.findFirst({
      where: { id: activityId, tripId, trip: { userId } },
    });
    if (!existing) throwApiError("Activity not found", 404);

    const start = startTime ? new Date(String(startTime)) : existing.startTime;
    const end = endTime ? new Date(String(endTime)) : existing.endTime;
    if (end <= start) throwApiError("Invalid activity time range", 400);

    return this.prisma.itineraryActivity.update({
      where: { id: activityId },
      data: {
        title: (title as string | undefined) ?? existing.title,
        description: (description as string | null | undefined) ?? existing.description,
        address: (address as string | null | undefined) ?? existing.address,
        latitude:
          body.latitude === undefined
            ? existing.latitude
            : parseOptionalCoordinate(body.latitude),
        longitude:
          body.longitude === undefined
            ? existing.longitude
            : parseOptionalCoordinate(body.longitude),
        startTime: start,
        endTime: end,
      },
    });
  }

  async remove(tripId: string, activityId: string, userId: string) {
    const activity = await this.prisma.itineraryActivity.findFirst({
      where: { id: activityId, tripId },
      include: { trip: true },
    });
    if (!activity || activity.trip.userId !== userId) {
      throwApiError("Activity not found", 404);
    }
    await this.prisma.itineraryActivity.delete({ where: { id: activityId } });
    return { success: true };
  }
}
