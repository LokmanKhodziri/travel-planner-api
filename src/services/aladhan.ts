const ALADHAN_API_URL =
  process.env.ALADHAN_API_URL ?? "https://api.aladhan.com/v1";

interface AladhanTimingResponse {
  data: {
    timings: Record<string, string>;
    date: { gregorian: { date: string }; hijri: { date: string } };
    meta: { timezone: string };
  };
}

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

/** Accepts YYYY-MM-DD and returns DD-MM-YYYY for Aladhan if needed. */
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
  date: string,
): Promise<PrayerTimings> {
  const aladhanDate = toAladhanDate(date);
  const response = await fetch(
    `${ALADHAN_API_URL}/timings/${encodeURIComponent(aladhanDate)}?latitude=${latitude}&longitude=${longitude}&method=2`,
  );
  if (!response.ok) throw new Error("Failed to fetch prayer timings");
  const data = (await response.json()) as AladhanTimingResponse;
  const timings = data.data.timings;

  return {
    date: data.data.date.gregorian.date,
    timezone: data.data.meta.timezone,
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
