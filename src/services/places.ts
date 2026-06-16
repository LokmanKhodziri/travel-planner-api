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
  userRatingsTotal?: number;
  openNow?: boolean;
  category?: string;
  about: string;
}

export interface PlaceSuggestion {
  id: string;
  description: string;
}

function buildPlaceAbout(place: any, category?: string) {
  const typeLabel = category ? category.toLowerCase() : "place";
  const parts = [`A nearby ${typeLabel} option for this trip location.`];

  if (typeof place.rating === "number") {
    const reviewText =
      typeof place.user_ratings_total === "number"
        ? ` from ${place.user_ratings_total} reviews`
        : "";
    parts.push(`Rated ${place.rating.toFixed(1)} on Google Maps${reviewText}.`);
  }

  if (typeof place.opening_hours?.open_now === "boolean") {
    parts.push(place.opening_hours.open_now ? "Currently open." : "Currently closed.");
  }

  return parts.join(" ");
}

function buildPlaceResult(place: any, category?: string): NearbyPlace {
  return {
    id: place.place_id,
    name: place.name,
    address: place.vicinity || place.formatted_address || "",
    latitude: place.geometry.location.lat,
    longitude: place.geometry.location.lng,
    rating: place.rating,
    userRatingsTotal: place.user_ratings_total,
    openNow: place.opening_hours?.open_now,
    category,
    about: buildPlaceAbout(place, category),
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
  category?: string,
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

  return (data.results || []).map((place: any) => buildPlaceResult(place, category));
}

const BASE_ACTIVITY_SEARCHES = [
  {
    type: "tourist_attraction",
    keyword: "things to do",
    category: "Attraction",
  },
  { type: "museum", keyword: "museum", category: "Museum" },
  { type: "park", keyword: "park", category: "Park" },
  {
    type: "shopping_mall",
    keyword: "shopping",
    category: "Shopping",
  },
] as const;

const EXTENDED_ACTIVITY_SEARCHES = [
  { type: "art_gallery", keyword: "gallery", category: "Gallery" },
  { type: "zoo", keyword: "zoo", category: "Zoo" },
  { type: "aquarium", keyword: "aquarium", category: "Aquarium" },
  {
    type: "amusement_park",
    keyword: "theme park",
    category: "Theme park",
  },
] as const;

export interface FindNearbyActivitiesOptions {
  excludeIds?: string[];
  limit?: number;
  extended?: boolean;
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
    "Halal restaurant",
  );
  if (results.length === 0 && radius < 25000) {
    return fetchNearbyPlaces(
      latitude,
      longitude,
      "restaurant",
      25000,
      "halal",
      "Halal restaurant",
    );
  }
  return results;
}

export async function findNearbyActivities(
  latitude: number,
  longitude: number,
  radius = 5000,
  options: FindNearbyActivitiesOptions = {},
): Promise<NearbyPlace[]> {
  const searches = options.extended
    ? [...BASE_ACTIVITY_SEARCHES, ...EXTENDED_ACTIVITY_SEARCHES]
    : [...BASE_ACTIVITY_SEARCHES];

  const results = await Promise.all(
    searches.map((search) =>
      fetchNearbyPlaces(
        latitude,
        longitude,
        search.type,
        radius,
        search.keyword,
        search.category,
      ).catch(() => []),
    ),
  );

  const excluded = new Set(options.excludeIds ?? []);
  const unique = new Map<string, NearbyPlace>();
  for (const place of results.flat()) {
    if (excluded.has(place.id)) continue;
    if (!unique.has(place.id)) unique.set(place.id, place);
  }

  const limit = options.limit ?? 12;
  return [...unique.values()]
    .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
    .slice(0, limit);
}
