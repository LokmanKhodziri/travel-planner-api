import type { Response, NextFunction } from "express";
import type { AuthRequest } from "./auth.js";

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();
let pruneCounter = 0;

function pruneExpired(now: number) {
  pruneCounter += 1;
  if (pruneCounter % 200 !== 0) return;
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export function rateLimit(options: {
  name: string;
  windowMs: number;
  max: number;
}) {
  return (req: AuthRequest, res: Response, next: NextFunction) => {
    const now = Date.now();
    pruneExpired(now);

    const identity = req.user?.id ?? req.ip ?? "anonymous";
    const key = `${options.name}:${identity}`;
    let bucket = buckets.get(key);
    if (!bucket || now >= bucket.resetAt) {
      bucket = { count: 0, resetAt: now + options.windowMs };
      buckets.set(key, bucket);
    }

    bucket.count += 1;
    const remaining = Math.max(0, options.max - bucket.count);
    const retryAfter = Math.max(1, Math.ceil((bucket.resetAt - now) / 1000));

    res.setHeader("X-RateLimit-Limit", String(options.max));
    res.setHeader("X-RateLimit-Remaining", String(remaining));
    res.setHeader("X-RateLimit-Reset", String(Math.ceil(bucket.resetAt / 1000)));

    if (bucket.count > options.max) {
      res.setHeader("Retry-After", String(retryAfter));
      res.status(429).json({
        error: "Too many requests. Please wait before trying again.",
        retryAfter,
      });
      return;
    }

    next();
  };
}

export const PLACES_LOOKUP_MAX_PER_MINUTE = 30;
export const PLACES_SEARCH_MAX_PER_MINUTE = 60;

/** Nearby, recommendations, travel times — these can fan out to Google. */
export const placesLookupLimit = rateLimit({
  name: "places-lookup",
  windowMs: 60_000,
  max: PLACES_LOOKUP_MAX_PER_MINUTE,
});

/** Autocomplete while typing. */
export const placesSearchLimit = rateLimit({
  name: "places-search",
  windowMs: 60_000,
  max: PLACES_SEARCH_MAX_PER_MINUTE,
});
