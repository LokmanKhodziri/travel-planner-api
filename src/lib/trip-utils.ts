import { prisma } from "./prisma.js";
import { geocodeAddress } from "../services/geocode.js";

export interface TripCoordinates {
  latitude: number;
  longitude: number;
  city?: string | null;
}

export async function getOwnedTrip(tripId: string, userId: string) {
  return prisma.trip.findFirst({
    where: { id: tripId, userId },
    include: {
      locations: { orderBy: { order: "asc" } },
      activities: { orderBy: { startTime: "asc" } },
    },
  });
}

export function resolveTripCoordinates(trip: {
  destinationLat: number | null;
  destinationLng: number | null;
  destinationCity: string | null;
  locations: { latitude: number; longitude: number }[];
}): TripCoordinates | null {
  if (trip.destinationLat != null && trip.destinationLng != null) {
    return {
      latitude: trip.destinationLat,
      longitude: trip.destinationLng,
      city: trip.destinationCity,
    };
  }

  if (trip.locations.length === 0) return null;

  const latitude =
    trip.locations.reduce((sum, loc) => sum + loc.latitude, 0) /
    trip.locations.length;
  const longitude =
    trip.locations.reduce((sum, loc) => sum + loc.longitude, 0) /
    trip.locations.length;

  return { latitude, longitude, city: trip.destinationCity };
}

export function distanceMeters(
  lat1: number,
  lng1: number,
  lat2: number,
  lng2: number,
): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earthRadiusM = 6371000;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return earthRadiusM * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export async function syncTripDestinationFromLocation(
  tripId: string,
  latitude: number,
  longitude: number,
  locationTitle: string,
) {
  const trip = await prisma.trip.findUnique({ where: { id: tripId } });
  if (!trip || trip.destinationLat != null) return;

  await prisma.trip.update({
    where: { id: tripId },
    data: {
      destinationCity: locationTitle,
      destinationLat: latitude,
      destinationLng: longitude,
    },
  });
}

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

export async function ensureTripLocation(
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
      const geocoded = await geocodeAddress(trimmedAddress);
      lat = geocoded.latitude;
      lng = geocoded.longitude;
    } catch {
      return null;
    }
  }

  const locations =
    existingLocations ??
    (await prisma.location.findMany({
      where: { tripId },
      orderBy: { order: "asc" },
    }));

  const duplicate = locations.find(
    (loc) => distanceMeters(loc.latitude, loc.longitude, lat!, lng!) < 150,
  );
  if (duplicate) return duplicate;

  const location = await prisma.location.create({
    data: {
      locationTitle: trimmedTitle,
      tripId,
      latitude: lat,
      longitude: lng,
      order: locations.length,
    },
  });
  await syncTripDestinationFromLocation(tripId, lat, lng, trimmedTitle);
  return location;
}

export async function syncTripLocationsFromActivities(
  tripId: string,
  userId: string,
) {
  const trip = await prisma.trip.findFirst({
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

    const synced = await ensureTripLocation(
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
