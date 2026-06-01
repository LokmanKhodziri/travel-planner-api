const GOOGLE_MAPS_API_KEY = process.env.GOOGLE_MAPS_API_KEY;

export interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  openNow?: boolean;
}

interface PlacesResponse {
  results?: Array<{
    place_id: string;
    name: string;
    vicinity?: string;
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
    rating?: number;
    opening_hours?: { open_now?: boolean };
  }>;
  status?: string;
  error_message?: string;
}

async function nearbySearch(params: URLSearchParams): Promise<NearbyPlace[]> {
  if (!GOOGLE_MAPS_API_KEY) {
    throw new Error("Google Places API is not configured");
  }

  params.set("key", GOOGLE_MAPS_API_KEY);
  const url = `https://maps.googleapis.com/maps/api/place/nearbysearch/json?${params.toString()}`;
  const response = await fetch(url);
  const data = (await response.json()) as PlacesResponse;

  if (data.status === "REQUEST_DENIED") {
    throw new Error(data.error_message ?? "Places API request denied");
  }

  if (data.status !== "OK" && data.status !== "ZERO_RESULTS") {
    throw new Error(data.error_message ?? `Places API error: ${data.status ?? "unknown"}`);
  }

  return (data.results ?? []).map((place) => ({
    id: place.place_id,
    name: place.name,
    address: place.vicinity ?? place.formatted_address ?? "",
    latitude: place.geometry?.location?.lat ?? 0,
    longitude: place.geometry?.location?.lng ?? 0,
    rating: place.rating,
    openNow: place.opening_hours?.open_now,
  }));
}

export async function findNearbyMosques(
  latitude: number,
  longitude: number,
  radius = 5000
): Promise<NearbyPlace[]> {
  const params = new URLSearchParams({
    location: `${latitude},${longitude}`,
    radius: String(radius),
    type: "mosque",
  });
  return nearbySearch(params);
}

export async function findNearbyHalal(
  latitude: number,
  longitude: number,
  radius = 5000
): Promise<NearbyPlace[]> {
  const params = new URLSearchParams({
    location: `${latitude},${longitude}`,
    radius: String(radius),
    keyword: "halal restaurant",
  });
  return nearbySearch(params);
}
