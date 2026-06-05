function getGooglePlacesApiKey() {
  return process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
}

const PLACES_BASE_URL =
  "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
const AUTOCOMPLETE_BASE_URL =
  "https://maps.googleapis.com/maps/api/place/autocomplete/json";

export interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  openNow?: boolean;
}

export interface PlaceSuggestion {
  id: string;
  description: string;
}

function buildPlaceResult(place: any): NearbyPlace {
  return {
    id: place.place_id,
    name: place.name,
    address: place.vicinity || place.formatted_address || "",
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    rating: place.rating,
    openNow: place.opening_hours?.open_now,
  };
}

function buildPlaceSuggestion(prediction: any): PlaceSuggestion {
  return {
    id: prediction.place_id,
    description: prediction.description,
  };
}

export async function searchPlaces(input: string): Promise<PlaceSuggestion[]> {
  const key = getGooglePlacesApiKey();
  if (!key) throw new Error("Google Places API key is not configured");

  const params = new URLSearchParams({ input, key });
  const url = `${AUTOCOMPLETE_BASE_URL}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch place suggestions");
  const data = await response.json();

  if (data.status !== "OK") {
    if (data.status === "ZERO_RESULTS") return [];
    const message = data.error_message
      ? `${data.status}: ${data.error_message}`
      : data.status;
    throw new Error(`Google Places API error: ${message}`);
  }

  return (data.predictions || []).map(buildPlaceSuggestion);
}

async function fetchNearbyPlaces(
  latitude: number,
  longitude: number,
  type: string,
  radius = 5000,
  keyword?: string,
): Promise<NearbyPlace[]> {
  const key = getGooglePlacesApiKey();
  if (!key) throw new Error("Google Places API key is not configured");

  const params = new URLSearchParams({
    location: `${latitude},${longitude}`,
    radius: String(radius),
    type,
    key,
  });
  if (keyword) params.set("keyword", keyword);

  const url = `${PLACES_BASE_URL}?${params.toString()}`;
  const response = await fetch(url);
  if (!response.ok) throw new Error("Failed to fetch nearby places");
  const data = await response.json();

  if (data.status !== "OK") {
    if (data.status === "ZERO_RESULTS") return [];
    const message = data.error_message
      ? `${data.status}: ${data.error_message}`
      : data.status;
    throw new Error(`Google Places API error: ${message}`);
  }

  return (data.results || []).map(buildPlaceResult);
}

export async function findNearbyMosques(
  latitude: number,
  longitude: number,
  radius = 5000,
): Promise<NearbyPlace[]> {
  const results = await fetchNearbyPlaces(
    latitude,
    longitude,
    "mosque",
    radius,
  );
  if (results.length === 0 && radius < 25000) {
    return fetchNearbyPlaces(latitude, longitude, "mosque", 25000);
  }
  return results;
}

export async function findNearbyHalal(
  latitude: number,
  longitude: number,
  radius = 5000,
): Promise<NearbyPlace[]> {
  const results = await fetchNearbyPlaces(
    latitude,
    longitude,
    "restaurant",
    radius,
    "halal",
  );
  if (results.length === 0 && radius < 25000) {
    return fetchNearbyPlaces(latitude, longitude, "restaurant", 25000, "halal");
  }
  return results;
}
