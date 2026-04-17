/**
 * Format hours value vs required minimum.
 * If required > 0, returns "hours / required" (e.g. "12 / 17").
 * Otherwise returns just the number.
 */
export function formatHoursVsRequired(hours: number, required?: number | null): string {
  if (required && required > 0) return `${hours} / ${required}`;
  return `${hours}`;
}
