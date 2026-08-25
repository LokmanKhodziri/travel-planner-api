import { Injectable, Optional } from "@nestjs/common";
import { AppCacheService } from "../cache/app-cache.service";
import { CACHE_TTL, cacheCoord } from "../cache/cache.constants";

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface GeocodeResult {
  county: string;
  formattedAddress: string;
}

@Injectable()
export class GeocodeService {
  constructor(@Optional() private readonly cache?: AppCacheService) {}
  private get apiKey() {
    return process.env.GOOGLE_MAPS_API_KEY;
  }

  async getCountyFromCoordinates(
    latitude: number,
    longitude: number,
  ): Promise<GeocodeResult> {
    const load = () => this.fetchCountyFromCoordinates(latitude, longitude);
    if (!this.cache) return load();
    return this.cache.remember(
      `geocode:reverse:${cacheCoord(latitude)}:${cacheCoord(longitude)}`,
      CACHE_TTL.geocode,
      load,
    );
  }

  private async fetchCountyFromCoordinates(
    latitude: number,
    longitude: number,
  ): Promise<GeocodeResult> {
    if (!this.apiKey) {
      return { county: "", formattedAddress: "" };
    }
    const response = await fetch(
      `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${this.apiKey}`,
    );
    const data = await response.json();
    const result = data.results?.[0];
    if (!result) return { county: "", formattedAddress: "" };
    const countyComponent = result.address_components?.find(
      (c: AddressComponent) => c.types.includes("country"),
    );
    return {
      county: countyComponent?.long_name ?? "",
      formattedAddress: result.formatted_address ?? "",
    };
  }

  async geocodeAddress(address: string): Promise<{
    latitude: number;
    longitude: number;
  }> {
    const load = () => this.fetchGeocodeAddress(address);
    if (!this.cache) return load();
    return this.cache.remember(
      `geocode:address:${address.trim().toLowerCase()}`,
      CACHE_TTL.geocode,
      load,
    );
  }

  private async fetchGeocodeAddress(address: string): Promise<{
    latitude: number;
    longitude: number;
  }> {
    if (!this.apiKey) {
      throw new Error("Geocoding service is not configured");
    }
    const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${this.apiKey}`;
    const response = await fetch(url);
    const data = await response.json();
    if (data.status === "REQUEST_DENIED") {
      throw new Error(data.error_message ?? "Invalid API key configuration");
    }
    const location = data.results?.[0]?.geometry?.location;
    if (!location) throw new Error("No results for address");
    return { latitude: location.lat, longitude: location.lng };
  }
}
