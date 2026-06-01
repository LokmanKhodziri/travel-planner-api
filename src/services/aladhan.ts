const ALADHAN_BASE = process.env.ALADHAN_API_BASE ?? "https://api.aladhan.com/v1";

export interface PrayerTimings {
  date: string;
  timezone: string;
  timings: {
    Fajr: string;
    Dhuhr: string;
    Asr: string;
    Maghrib: string;
    Isha: string;
  };
}

const PRAYER_KEYS = ["Fajr", "Dhuhr", "Asr", "Maghrib", "Isha"] as const;

function cleanTime(value: string): string {
  return value.split(" ")[0] ?? value;
}

/** Accepts YYYY-MM-DD or DD-MM-YYYY and returns DD-MM-YYYY for Aladhan. */
function toAladhanDate(date: string): string {
  const parts = date.split("-");
  if (parts.length !== 3) return date;
  if (parts[0].length === 4) {
    return `${parts[2]}-${parts[1]}-${parts[0]}`;
  }
  return date;
}

export async function getPrayerTimings(
  latitude: number,
  longitude: number,
  date: string
): Promise<PrayerTimings> {
  const aladhanDate = toAladhanDate(date);
  const url = `${ALADHAN_BASE}/timings/${aladhanDate}?latitude=${latitude}&longitude=${longitude}&method=2`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error("Failed to fetch prayer times");
  }

  const data = (await response.json()) as {
    data?: {
      date?: { readable?: string; gregorian?: { date?: string } };
      meta?: { timezone?: string };
      timings?: Record<string, string>;
    };
  };

  const timings = data.data?.timings;
  if (!timings) {
    throw new Error("Prayer times unavailable for this location");
  }

  return {
    date: data.data?.date?.gregorian?.date ?? date,
    timezone: data.data?.meta?.timezone ?? "UTC",
    timings: {
      Fajr: cleanTime(timings.Fajr),
      Dhuhr: cleanTime(timings.Dhuhr),
      Asr: cleanTime(timings.Asr),
      Maghrib: cleanTime(timings.Maghrib),
      Isha: cleanTime(timings.Isha),
    },
  };
}

export function listOrderedPrayers(timings: PrayerTimings["timings"]) {
  return PRAYER_KEYS.map((name) => ({ name, time: timings[name] }));
}
