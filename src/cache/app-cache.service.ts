import { Inject, Injectable } from "@nestjs/common";
import { CACHE_MANAGER } from "@nestjs/cache-manager";
import type { Cache } from "cache-manager";

@Injectable()
export class AppCacheService {
  constructor(@Inject(CACHE_MANAGER) private readonly cache: Cache) {}

  async get<T>(key: string): Promise<T | undefined> {
    const value = await this.cache.get<T>(key);
    return value ?? undefined;
  }

  async set<T>(key: string, value: T, ttlMs: number): Promise<void> {
    await this.cache.set(key, value, ttlMs);
  }

  /**
   * Return a cached value, or compute it once, store it, and return it.
   * Failed fetches are not cached, so the next request can retry.
   */
  async remember<T>(
    key: string,
    ttlMs: number,
    factory: () => Promise<T>,
  ): Promise<T> {
    const cached = await this.get<T>(key);
    if (cached !== undefined) {
      return cached;
    }

    const value = await factory();
    await this.set(key, value, ttlMs);
    return value;
  }
}
