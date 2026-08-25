import { Injectable } from "@nestjs/common";

const PLACES_BASE_URL =
  "https://maps.googleapis.com/maps/api/place/nearbysearch/json";
const PLACE_DETAILS_BASE_URL =
  "https://maps.googleapis.com/maps/api/place/details/json";
const AUTOCOMPLETE_BASE_URL =
  "https://maps.googleapis.com/maps/api/place/autocomplete/json";

export interface PlaceOpeningPeriod {
  openDay: number;
  openTime: string;
  closeDay: number;
  closeTime?: string;
}

export interface PlaceOpeningHours {
  openNow?: boolean;
  weekdayText?: string[];
  periods?: PlaceOpeningPeriod[];
}

export interface NearbyPlace {
  id: string;
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  rating?: number;
  userRatingsTotal?: number;
  openNow?: boolean;
  openingHours?: PlaceOpeningHours;
  category?: string;
  about: string;
}

export interface PlaceSuggestion {
  id: string;
  description: string;
}

export interface FindNearbyActivitiesOptions {
  excludeIds?: string[];
  limit?: number;
  extended?: boolean;
}

const BASE_ACTIVITY_SEARCHES = [
  {
    type: "tourist_attraction",
    keyword: "things to do",
    category: "Attraction",
  },
  { type: "museum", keyword: "museum", category: "Museum" },
  { type: "park", keyword: "park", category: "Park" },
  { type: "shopping_mall", keyword: "shopping", category: "Shopping" },
] as const;

const LOCAL_SPECIAL_SEARCHES = [
  { type: "tourist_attraction", keyword: "local market", category: "Local special" },
  { type: "tourist_attraction", keyword: "night market", category: "Local special" },
  { type: "tourist_attraction", keyword: "street food", category: "Local special" },
  { type: "point_of_interest", keyword: "pasar malam", category: "Local special" },
  { type: "tourist_attraction", keyword: "cultural village", category: "Local special" },
] as const;

const EXTENDED_ACTIVITY_SEARCHES = [
  { type: "art_gallery", keyword: "gallery", category: "Gallery" },
  { type: "zoo", keyword: "zoo", category: "Zoo" },
  { type: "aquarium", keyword: "aquarium", category: "Aquarium" },
  { type: "amusement_park", keyword: "theme park", category: "Theme park" },
] as const;

@Injectable()
export class PlacesService {
  private get apiKey() {
    return process.env.GOOGLE_PLACES_API_KEY ?? process.env.GOOGLE_MAPS_API_KEY;
  }

  private buildPlaceAbout(place: Record<string, any>, category?: string) {
    const parts =
      category === "Local special"
        ? [
            "A local-special pick — markets, street food, or culture unique to this area.",
          ]
        : [
            `A nearby ${category ? category.toLowerCase() : "place"} option for this trip location.`,
          ];

    if (typeof place.rating === "number") {
      const reviewText =
        typeof place.user_ratings_total === "number"
          ? ` from ${place.user_ratings_total} reviews`
          : "";
      parts.push(`Rated ${place.rating.toFixed(1)} on Google Maps${reviewText}.`);
    }

    if (typeof place.opening_hours?.open_now === "boolean") {
      parts.push(
        place.opening_hours.open_now ? "Currently open." : "Currently closed.",
      );
    }

    if (category === "Local special" && place.opening_hours?.weekday_text?.length) {
      const today = new Date().getDay();
      const todayHours = place.opening_hours.weekday_text[today];
      if (todayHours) parts.push(`Hours today: ${todayHours}.`);
    }

    return parts.join(" ");
  }

  parseOpeningHours(raw: any): PlaceOpeningHours | undefined {
    if (!raw) return undefined;
    return {
      openNow: raw.open_now,
      weekdayText: raw.weekday_text,
      periods: (raw.periods || []).map((period: any) => ({
        openDay: period.open.day,
        openTime: period.open.time,
        closeDay: period.close?.day ?? period.open.day,
        closeTime: period.close?.time,
      })),
    };
  }

  private buildPlaceResult(
    place: any,
    category?: string,
    openingHours?: PlaceOpeningHours,
  ): NearbyPlace {
    const parsedHours = openingHours ?? this.parseOpeningHours(place.opening_hours);
    return {
      id: place.place_id,
      name: place.name,
      address: place.vicinity || place.formatted_address || "",
      latitude: place.geometry.location.lat,
      longitude: place.geometry.location.lng,
      rating: place.rating,
      userRatingsTotal: place.user_ratings_total,
      openNow: parsedHours?.openNow,
      openingHours: parsedHours,
      category,
      about: this.buildPlaceAbout(place, category),
    };
  }

  async searchPlaces(input: string): Promise<PlaceSuggestion[]> {
    const key = this.apiKey;
    if (!key) throw new Error("Google Places API key is not configured");

    const params = new URLSearchParams({ input, key });
    const response = await fetch(`${AUTOCOMPLETE_BASE_URL}?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch place suggestions");
    const data = await response.json();

    if (data.status !== "OK") {
      if (data.status === "ZERO_RESULTS") return [];
      const message = data.error_message
        ? `${data.status}: ${data.error_message}`
        : data.status;
      throw new Error(`Google Places API error: ${message}`);
    }

    return (data.predictions || []).map((prediction: any) => ({
      id: prediction.place_id,
      description: prediction.description,
    }));
  }

  private async fetchNearbyPlaces(
    latitude: number,
    longitude: number,
    type: string,
    radius = 5000,
    keyword?: string,
    category?: string,
  ): Promise<NearbyPlace[]> {
    const key = this.apiKey;
    if (!key) throw new Error("Google Places API key is not configured");

    const params = new URLSearchParams({
      location: `${latitude},${longitude}`,
      radius: String(radius),
      type,
      key,
    });
    if (keyword) params.set("keyword", keyword);

    const response = await fetch(`${PLACES_BASE_URL}?${params.toString()}`);
    if (!response.ok) throw new Error("Failed to fetch nearby places");
    const data = await response.json();

    if (data.status !== "OK") {
      if (data.status === "ZERO_RESULTS") return [];
      const message = data.error_message
        ? `${data.status}: ${data.error_message}`
        : data.status;
      throw new Error(`Google Places API error: ${message}`);
    }

    return (data.results || []).map((place: any) =>
      this.buildPlaceResult(place, category),
    );
  }

  private async fetchPlaceOpeningHours(placeId: string) {
    const key = this.apiKey;
    if (!key) throw new Error("Google Places API key is not configured");

    const params = new URLSearchParams({
      place_id: placeId,
      fields: "opening_hours",
      key,
    });
    const response = await fetch(
      `${PLACE_DETAILS_BASE_URL}?${params.toString()}`,
    );
    if (!response.ok) throw new Error("Failed to fetch place opening hours");
    const data = await response.json();

    if (data.status !== "OK") {
      if (data.status === "NOT_FOUND") return undefined;
      const message = data.error_message
        ? `${data.status}: ${data.error_message}`
        : data.status;
      throw new Error(`Google Places API error: ${message}`);
    }

    return this.parseOpeningHours(data.result?.opening_hours);
  }

  private async enrichPlaceWithOpeningHours(place: NearbyPlace): Promise<NearbyPlace> {
    if (place.openingHours?.periods?.length) return place;
    try {
      const openingHours = await this.fetchPlaceOpeningHours(place.id);
      if (!openingHours) return place;
      return {
        ...place,
        openNow: openingHours.openNow ?? place.openNow,
        openingHours,
        about: place.about,
      };
    } catch {
      return place;
    }
  }

  private enrichLocalSpecialPlaces(places: NearbyPlace[]) {
    return Promise.all(
      places.map((place) =>
        place.category === "Local special"
          ? this.enrichPlaceWithOpeningHours(place)
          : Promise.resolve(place),
      ),
    );
  }

  async findNearbyMosques(
    latitude: number,
    longitude: number,
    radius = 5000,
  ): Promise<NearbyPlace[]> {
    const results = await this.fetchNearbyPlaces(
      latitude,
      longitude,
      "mosque",
      radius,
    );
    if (results.length === 0 && radius < 25000) {
      return this.fetchNearbyPlaces(latitude, longitude, "mosque", 25000);
    }
    return results;
  }

  async findNearbyHalal(
    latitude: number,
    longitude: number,
    radius = 5000,
  ): Promise<NearbyPlace[]> {
    const results = await this.fetchNearbyPlaces(
      latitude,
      longitude,
      "restaurant",
      radius,
      "halal",
      "Halal restaurant",
    );
    if (results.length === 0 && radius < 25000) {
      return this.fetchNearbyPlaces(
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

  async findNearbyActivities(
    latitude: number,
    longitude: number,
    radius = 5000,
    options: FindNearbyActivitiesOptions = {},
  ): Promise<NearbyPlace[]> {
    const standardSearches = options.extended
      ? [...BASE_ACTIVITY_SEARCHES, ...EXTENDED_ACTIVITY_SEARCHES]
      : [...BASE_ACTIVITY_SEARCHES];

    const [standardResults, localSpecialResults] = await Promise.all([
      Promise.all(
        standardSearches.map((search) =>
          this.fetchNearbyPlaces(
            latitude,
            longitude,
            search.type,
            radius,
            search.keyword,
            search.category,
          ).catch(() => []),
        ),
      ),
      Promise.all(
        LOCAL_SPECIAL_SEARCHES.map((search) =>
          this.fetchNearbyPlaces(
            latitude,
            longitude,
            search.type,
            radius,
            search.keyword,
            search.category,
          ).catch(() => []),
        ),
      ),
    ]);

    const excluded = new Set(options.excludeIds ?? []);
    const unique = new Map<string, NearbyPlace>();
    for (const place of standardResults.flat()) {
      if (excluded.has(place.id)) continue;
      if (!unique.has(place.id)) unique.set(place.id, place);
    }
    for (const place of localSpecialResults.flat()) {
      if (excluded.has(place.id)) continue;
      if (!unique.has(place.id)) unique.set(place.id, place);
    }

    const limit = options.limit ?? 12;
    const ranked = [...unique.values()]
      .sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0))
      .slice(0, limit);

    return this.enrichLocalSpecialPlaces(ranked);
  }
}
