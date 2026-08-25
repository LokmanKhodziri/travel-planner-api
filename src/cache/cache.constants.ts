/** Time-to-live in milliseconds for external API responses. */
export const CACHE_TTL = {
  prayerTimes: 12 * 60 * 60 * 1000,
  geocode: 7 * 24 * 60 * 60 * 1000,
  placesNearby: 30 * 60 * 1000,
  placesSearch: 10 * 60 * 1000,
  placeDetails: 6 * 60 * 60 * 1000,
  travelEstimate: 15 * 60 * 1000,
} as const;

/** Round coordinates so nearby GPS jitter still shares a cache entry (~11m). */
export function cacheCoord(value: number): string {
  return value.toFixed(4);
}
