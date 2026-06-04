import { prisma } from "./prisma.js";

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

export async function getOwnedTrip(tripId: string, userId: string) {
  return prisma.trip.findFirst({
    where: { id: tripId, userId },
    include: {
      locations: true,
      activities: true,
    },
  });
}

export function resolveTripCoordinates(trip: {
  locations: { latitude: number; longitude: number }[];
}) {
  if (!trip.locations?.length) return null;
  const { latitude, longitude } = trip.locations[0];
  return { latitude, longitude };
}
