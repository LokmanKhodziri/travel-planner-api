import { Injectable, Optional } from "@nestjs/common";
import { AppCacheService } from "../cache/app-cache.service";
import { CACHE_TTL, cacheCoord } from "../cache/cache.constants";
import { distanceMeters } from "../common/geo";

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

@Injectable()
export class DistanceMatrixService {
  constructor(@Optional() private readonly cache?: AppCacheService) {}
  private get apiKey() {
    return process.env.GOOGLE_MAPS_API_KEY ?? process.env.GOOGLE_PLACES_API_KEY;
  }

  async getTravelEstimate(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode: TravelMode,
  ): Promise<Omit<TravelEstimate, "autoWalk">> {
    const load = () => this.fetchTravelEstimate(origin, destination, mode);
    if (!this.cache) return load();
    return this.cache.remember(
      `travel:${mode}:${cacheCoord(origin.latitude)}:${cacheCoord(origin.longitude)}:${cacheCoord(destination.latitude)}:${cacheCoord(destination.longitude)}`,
      CACHE_TTL.travelEstimate,
      load,
    );
  }

  private async fetchTravelEstimate(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    mode: TravelMode,
  ): Promise<Omit<TravelEstimate, "autoWalk">> {
    const key = this.apiKey;
    if (!key) throw new Error("Google Maps API key is not configured");

    const params = new URLSearchParams({
      origins: `${origin.latitude},${origin.longitude}`,
      destinations: `${destination.latitude},${destination.longitude}`,
      mode,
      units: "metric",
      key,
    });

    const response = await fetch(
      `https://maps.googleapis.com/maps/api/distancematrix/json?${params.toString()}`,
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
      throw new Error(
        `Travel estimate unavailable: ${element?.status ?? "NO_RESULT"}`,
      );
    }

    return {
      distanceText: element.distance.text,
      distanceMeters: element.distance.value,
      durationText: element.duration.text,
      durationSeconds: element.duration.value,
      mode,
      modeLabel: TRAVEL_MODE_LABELS[mode],
    };
  }

  async getSmartTravelEstimate(
    origin: { latitude: number; longitude: number },
    destination: { latitude: number; longitude: number },
    preferredMode: TravelMode,
  ): Promise<TravelEstimate> {
    const { mode, autoWalk } = resolveTravelMode(
      preferredMode,
      origin,
      destination,
    );
    const estimate = await this.getTravelEstimate(origin, destination, mode);
    return { ...estimate, autoWalk };
  }
}
