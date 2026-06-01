import { getPrayerTimings, listOrderedPrayers } from "./aladhan.js";

export interface PrayerConflict {
  activityId: string;
  activityTitle: string;
  prayerName: string;
  prayerTime: string;
  message: string;
}

interface ActivityInput {
  id: string;
  title: string;
  startTime: Date;
  endTime: Date;
}

function parsePrayerDateTime(dateIso: string, time: string): Date {
  const [year, month, day] = dateIso.split("-").map(Number);
  const [hours, minutes] = time.split(":").map(Number);
  return new Date(year, month - 1, day, hours, minutes, 0, 0);
}

function sameCalendarDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

function overlaps(activityStart: Date, activityEnd: Date, windowStart: Date, windowEnd: Date) {
  return activityStart < windowEnd && windowStart < activityEnd;
}

export async function detectPrayerConflicts(
  latitude: number,
  longitude: number,
  date: string,
  activities: ActivityInput[]
): Promise<PrayerConflict[]> {
  const prayerData = await getPrayerTimings(latitude, longitude, date);
  const ordered = listOrderedPrayers(prayerData.timings);
  const conflicts: PrayerConflict[] = [];

  const dayActivities = activities.filter((activity) => {
    const sample = parsePrayerDateTime(date, "00:00");
    return sameCalendarDay(activity.startTime, sample);
  });

  for (let i = 0; i < ordered.length; i++) {
    const prayer = ordered[i];
    const prayerStart = parsePrayerDateTime(date, prayer.time);
    const nextPrayer = ordered[i + 1];
    const defaultEnd = new Date(prayerStart.getTime() + 45 * 60 * 1000);
    const prayerEnd = nextPrayer
      ? parsePrayerDateTime(date, nextPrayer.time)
      : defaultEnd;

    for (const activity of dayActivities) {
      if (overlaps(activity.startTime, activity.endTime, prayerStart, prayerEnd)) {
        conflicts.push({
          activityId: activity.id,
          activityTitle: activity.title,
          prayerName: prayer.name,
          prayerTime: prayer.time,
          message: `"${activity.title}" overlaps with ${prayer.name} prayer (${prayer.time}).`,
        });
      }
    }
  }

  return conflicts;
}
