import { AppCacheService } from "./app-cache.service";

describe("AppCacheService", () => {
  const store = new Map<string, unknown>();
  const cache = {
    get: jest.fn(async (key: string) => store.get(key)),
    set: jest.fn(async (key: string, value: unknown) => {
      store.set(key, value);
    }),
    del: jest.fn(async (key: string) => {
      store.delete(key);
    }),
  };
  const service = new AppCacheService(cache as never);

  beforeEach(() => {
    store.clear();
    jest.clearAllMocks();
  });

  it("computes a value on a cache miss and stores it", async () => {
    const factory = jest.fn(async () => ({ fajr: "05:42" }));
    const result = await service.remember("prayer:kl", 1000, factory);
    expect(result).toEqual({ fajr: "05:42" });
    expect(factory).toHaveBeenCalledTimes(1);
    expect(cache.set).toHaveBeenCalledWith("prayer:kl", { fajr: "05:42" }, 1000);
  });

  it("returns the stored value on a cache hit without recomputing", async () => {
    store.set("prayer:kl", { fajr: "05:42" });
    const factory = jest.fn(async () => ({ fajr: "should-not-run" }));
    await expect(service.remember("prayer:kl", 1000, factory)).resolves.toEqual({
      fajr: "05:42",
    });
    expect(factory).not.toHaveBeenCalled();
  });

  it("does not cache a failed fetch", async () => {
    const factory = jest.fn(async () => {
      throw new Error("upstream down");
    });
    await expect(service.remember("prayer:kl", 1000, factory)).rejects.toThrow(
      "upstream down",
    );
    expect(cache.set).not.toHaveBeenCalled();
  });
});
