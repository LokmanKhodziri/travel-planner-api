import { toAladhanDate, cleanTime, AladhanService } from "./aladhan.service";
import { AppCacheService } from "../cache/app-cache.service";

describe("toAladhanDate", () => {
  it("converts YYYY-MM-DD to DD-MM-YYYY", () => {
    expect(toAladhanDate("2026-08-25")).toBe("25-08-2026");
  });

  it("leaves already-formatted dates alone", () => {
    expect(toAladhanDate("25-08-2026")).toBe("25-08-2026");
  });
});

describe("cleanTime", () => {
  it("strips timezone suffixes", () => {
    expect(cleanTime("05:42 (MYT)")).toBe("05:42");
  });
});

describe("AladhanService", () => {
  const store = new Map<string, unknown>();
  const cache = new AppCacheService({
    get: async (key: string) => store.get(key),
    set: async (key: string, value: unknown) => {
      store.set(key, value);
    },
  } as never);
  const service = new AladhanService(cache);

  beforeEach(() => {
    store.clear();
  });

  it("maps Aladhan timings into the API shape", async () => {
    const fetchMock = jest.spyOn(global, "fetch").mockResolvedValue({
      ok: true,
      json: async () => ({
        data: {
          timings: {
            Fajr: "05:42 (MYT)",
            Dhuhr: "13:15",
            Asr: "16:30",
            Maghrib: "19:20",
            Isha: "20:35",
          },
          date: { gregorian: { date: "25-08-2026" } },
          meta: { timezone: "Asia/Kuala_Lumpur" },
        },
      }),
    } as Response);

    const timings = await service.getPrayerTimings(3.14, 101.69, "2026-08-25");
    expect(timings.timings.Fajr).toBe("05:42");
    expect(timings.timezone).toBe("Asia/Kuala_Lumpur");
    expect(fetchMock).toHaveBeenCalledTimes(1);

    await service.getPrayerTimings(3.14, 101.69, "2026-08-25");
    expect(fetchMock).toHaveBeenCalledTimes(1);
    fetchMock.mockRestore();
  });
});
