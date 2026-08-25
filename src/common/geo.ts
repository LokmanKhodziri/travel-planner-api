export interface TripCoordinates {
  latitude: number;
  longitude: number;
  city?: string | null;
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
