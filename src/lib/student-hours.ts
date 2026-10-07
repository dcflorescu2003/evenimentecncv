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
