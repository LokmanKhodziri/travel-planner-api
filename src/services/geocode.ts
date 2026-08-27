import {
  CACHE_TTL_MS,
  cached,
  fetchWithTimeout,
  roundCoord,
} from "../lib/ttl-cache.js";

const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

export interface GeocodeResult {
  county: string;
  formattedAddress: string;
}

export async function getCountyFromCoordinates(
  latitude: number,
  longitude: number
): Promise<GeocodeResult> {
  if (!GOOGLE_MAPS_API_KEY) {
    return { county: "", formattedAddress: "" };
  }
  return cached(
    `geocode:reverse:${roundCoord(latitude, 4)}:${roundCoord(longitude, 4)}`,
    CACHE_TTL_MS.geocode,
    async () => {
      const response = await fetchWithTimeout(
        `https://maps.googleapis.com/maps/api/geocode/json?latlng=${latitude},${longitude}&key=${GOOGLE_MAPS_API_KEY}`,
      );
      const data = await response.json();
      const result = data.results?.[0];
      if (!result) return { county: "", formattedAddress: "" };
      const countyComponent = result.address_components?.find(
        (c: AddressComponent) => c.types.includes("country")
      );
      return {
        county: countyComponent?.long_name ?? "",
        formattedAddress: result.formatted_address ?? "",
      };
    },
  );
}

export async function geocodeAddress(address: string): Promise<{
  latitude: number;
  longitude: number;
}> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Geocoding service is not configured");
  }
  const normalized = address.trim().toLowerCase();
  return cached(
    `geocode:address:${normalized}`,
    CACHE_TTL_MS.geocode,
    async () => {
      const url = `https://maps.googleapis.com/maps/api/geocode/json?address=${encodeURIComponent(address)}&key=${GOOGLE_MAPS_API_KEY}`;
      const response = await fetchWithTimeout(url);
      const data = await response.json();
      if (data.status === "REQUEST_DENIED") {
        throw new Error(data.error_message ?? "Invalid API key configuration");
      }
      const location = data.results?.[0]?.geometry?.location;
      if (!location) throw new Error("No results for address");
      return { latitude: location.lat, longitude: location.lng };
    },
  );
}
