const DEFAULT_MAX_SIZE = 800;

type Entry = { value: unknown; expiresAt: number };
type CacheHit<T> = { hit: true; value: T } | { hit: false };

const inflight = new Map<string, Promise<unknown>>();

export const CACHE_TTL_MS = {
  places: 12 * 60 * 60 * 1000,
  placeDetails: 12 * 60 * 60 * 1000,
  prayer: 24 * 60 * 60 * 1000,
  travel: 3 * 60 * 60 * 1000,
  autocomplete: 15 * 60 * 1000,
  geocode: 24 * 60 * 60 * 1000,
} as const;

export function roundCoord(value: number, digits = 3): string {
  return value.toFixed(digits);
}

function cloneValue<T>(value: T): T {
  if (value === undefined || value === null) return value;
  return structuredClone(value);
}

class TtlLruCache {
  private store = new Map<string, Entry>();

  constructor(private readonly maxSize = DEFAULT_MAX_SIZE) {}

  get<T>(key: string): CacheHit<T> {
    const entry = this.store.get(key);
    if (!entry) return { hit: false };
    if (Date.now() >= entry.expiresAt) {
      this.store.delete(key);
      return { hit: false };
    }
    this.store.delete(key);
    this.store.set(key, entry);
    return { hit: true, value: cloneValue(entry.value) as T };
  }

  set<T>(key: string, value: T, ttlMs: number): void {
    if (this.store.has(key)) this.store.delete(key);
    this.store.set(key, {
      value: cloneValue(value),
      expiresAt: Date.now() + ttlMs,
    });
    while (this.store.size > this.maxSize) {
      const oldest = this.store.keys().next().value;
      if (oldest === undefined) break;
      this.store.delete(oldest);
    }
  }
}

const cache = new TtlLruCache();

export async function cached<T>(
  key: string,
  ttlMs: number,
  load: () => Promise<T>,
): Promise<T> {
  const existing = cache.get<T>(key);
  if (existing.hit) return existing.value;

  const pending = inflight.get(key);
  if (pending) return pending as Promise<T>;

  const promise = load()
    .then((value) => {
      cache.set(key, value, ttlMs);
      return cloneValue(value);
    })
    .finally(() => {
      inflight.delete(key);
    });

  inflight.set(key, promise);
  return promise;
}

export const EXTERNAL_FETCH_TIMEOUT_MS = 8_000;

export async function fetchWithTimeout(
  url: string,
  timeoutMs = EXTERNAL_FETCH_TIMEOUT_MS,
): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { signal: controller.signal });
  } catch (error) {
    if ((error as Error).name === "AbortError") {
      throw new Error(`External API timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
}
