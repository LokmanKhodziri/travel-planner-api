import { distanceMeters } from "../lib/trip-utils.js";
import {
  CACHE_TTL_MS,
  cached,
  fetchWithTimeout,
  roundCoord,
} from "../lib/ttl-cache.js";

function getGoogleMapsApiKey() {
  return process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
}

const DISTANCE_MATRIX_BASE_URL =
  "https://maps.googleapis.com/maps/api/distancematrix/json";

export type TravelMode = "walking" | "driving" | "transit";

export const WALKING_AUTO_THRESHOLD_METERS = 800;

export const TRAVEL_MODE_LABELS: Record<TravelMode, string> = {
  walking: "Walk",
  driving: "Drive",
  transit: "Transit",
};

export interface TravelEstimate {
  distanceText: string;
  distanceMeters: number;
  durationText: string;
  durationSeconds: number;
  mode: TravelMode;
  modeLabel: string;
  autoWalk: boolean;
}

export function parseTravelMode(value: unknown): TravelMode {
  if (value === "walking" || value === "transit" || value === "driving") {
    return value;
  }
  return "driving";
}

export function resolveTravelMode(
  preferredMode: TravelMode,
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
): { mode: TravelMode; autoWalk: boolean } {
  const straightLineMeters = distanceMeters(
    origin.latitude,
    origin.longitude,
    destination.latitude,
    destination.longitude,
  );

  if (straightLineMeters <= WALKING_AUTO_THRESHOLD_METERS) {
    return { mode: "walking", autoWalk: preferredMode !== "walking" };
  }

  return { mode: preferredMode, autoWalk: false };
}

export async function getTravelEstimate(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  mode: TravelMode,
): Promise<Omit<TravelEstimate, "autoWalk">> {
  const key = getGoogleMapsApiKey();
  if (!key) throw new Error("Google Maps API key is not configured");

  const cacheKey = [
    "travel",
    mode,
    roundCoord(origin.latitude, 4),
    roundCoord(origin.longitude, 4),
    roundCoord(destination.latitude, 4),
    roundCoord(destination.longitude, 4),
  ].join(":");

  return cached(cacheKey, CACHE_TTL_MS.travel, async () => {
    const params = new URLSearchParams({
      origins: `${origin.latitude},${origin.longitude}`,
      destinations: `${destination.latitude},${destination.longitude}`,
      mode,
      units: "metric",
      key,
    });

    const response = await fetchWithTimeout(
      `${DISTANCE_MATRIX_BASE_URL}?${params.toString()}`,
    );
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
      mode,
      modeLabel: TRAVEL_MODE_LABELS[mode],
    };
  });
}

export async function getSmartTravelEstimate(
  origin: { latitude: number; longitude: number },
  destination: { latitude: number; longitude: number },
  preferredMode: TravelMode,
): Promise<TravelEstimate> {
  const { mode, autoWalk } = resolveTravelMode(preferredMode, origin, destination);
  const estimate = await getTravelEstimate(origin, destination, mode);
  return { ...estimate, autoWalk };
}
