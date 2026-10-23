/** Maximum hours counted per student per calendar day. */
export const DAILY_HOURS_CAP = 4;

/** Sum hours per day, capping each day at DAILY_HOURS_CAP. */
export function cappedHours(items: { date?: string | null; hours?: number | null }[]): number {
  const perDay = new Map<string, number>();
  for (const it of items) {
    const k = it.date ?? "";
    perDay.set(k, (perDay.get(k) ?? 0) + (it.hours ?? 0));
  }
  let total = 0;
  perDay.forEach((h) => { total += Math.min(DAILY_HOURS_CAP, h); });
  return total;
}

/** Hours already counted on a given day (uncapped sum) → remaining capacity. */
export function remainingForDay(dayHours: number): number {
  return Math.max(0, DAILY_HOURS_CAP - dayHours);
}

/** All Monday–Friday dates (YYYY-MM-DD) between start and end inclusive. */
export function weekdaysBetween(start: string, end: string): string[] {
  const out: string[] = [];
  const d = new Date(start + "T12:00:00Z");
  const e = new Date(end + "T12:00:00Z");
  while (d <= e) {
    const wd = d.getUTCDay();
    if (wd >= 1 && wd <= 5) out.push(d.toISOString().slice(0, 10));
    d.setUTCDate(d.getUTCDate() + 1);
  }
  return out;
}

/**
 * Per-day capped hours and missing hours for a student.
 * Only days strictly before `today` count toward absences.
 */
export function computeDailyAbsences(
  days: string[],
  hoursByDay: Map<string, number>,
  today: string,
) {
  const perDay: Record<string, number> = {};
  let absences = 0;
  for (const day of days) {
    const h = Math.min(DAILY_HOURS_CAP, hoursByDay.get(day) ?? 0);
    perDay[day] = h;
    if (day < today) absences += DAILY_HOURS_CAP - h;
  }
  return { perDay, absences };
}
