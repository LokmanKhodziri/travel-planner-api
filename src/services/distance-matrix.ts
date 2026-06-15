function getGoogleMapsApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
}

const DISTANCE_MATRIX_BASE_URL =
  "https://maps.googleapis.com/maps/api/distancematrix/json";

export interface TravelEstimate {
  distanceText: string;
  distanceMeters: number;
  durationText: string;
  durationSeconds: number;
}

export async function getTravelEstimate(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
): Promise<TravelEstimate> {
  const key = getGoogleMapsApiKey();
  if (!key) throw new Error("Google Maps API key is not configured");

  const params = new URLSearchParams({
    origins: `${origin.latitude},${origin.longitude}`,
    destinations: `${destination.latitude},${destination.longitude}`,
    mode: "driving",
    units: "metric",
    key,
  });

  const response = await fetch(`${DISTANCE_MATRIX_BASE_URL}?${params.toString()}`);
  if (!response.ok) throw new Error("Failed to fetch travel estimate");

  const data = await response.json();
  if (data.status !== "OK") {
    const message = data.error_message
      ? `${data.status}: ${data.error_message}`
      : data.status;
    throw new Error(`Google Distance Matrix API error: ${message}`);
  }

  const element = data.rows?.[0]?.elements?.[0];
  if (!element || element.status !== "OK") {
    throw new Error(`Travel estimate unavailable: ${element?.status ?? "NO_RESULT"}`);
  }

  return {
    distanceText: element.distance.text,
    distanceMeters: element.distance.value,
    durationText: element.duration.text,
    durationSeconds: element.duration.value,
  };
}
