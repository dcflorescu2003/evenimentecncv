export type WeekSlot = "A" | "B";
export type DutyShift = "morning" | "afternoon";

export const WEEKDAY_LABELS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri"];

/** Data curentă (Y-M-D) în fusul Europe/Bucharest. */
export function bucharestToday(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit" }).format(now);
}

function toUtc(ymd: string): number {
  const [y, m, d] = ymd.split("-").map(Number);
  return Date.UTC(y, m - 1, d);
}
function fromUtc(ms: number): string {
  return new Date(ms).toISOString().slice(0, 10);
}
export function addDays(ymd: string, days: number): string {
  return fromUtc(toUtc(ymd) + days * 86400000);
}

/** Lunea săptămânii; sâmbăta și duminica trec la săptămâna următoare. */
export function displayMonday(ymd: string): string {
  const dow = new Date(toUtc(ymd)).getUTCDay(); // 0=dum
  if (dow === 0) return addDays(ymd, 1);
  if (dow === 6) return addDays(ymd, 2);
  return addDays(ymd, 1 - dow);
}

/** A dacă diferența de săptămâni față de ancoră e pară, altfel B. */
export function weekSlotFor(monday: string, anchorMonday: string): WeekSlot {
  const weeks = Math.round((toUtc(monday) - toUtc(anchorMonday)) / (7 * 86400000));
  return ((weeks % 2) + 2) % 2 === 0 ? "A" : "B";
}

/** Inversarea ciclului: ancora se mută cu o săptămână. */
export function swapAnchor(anchorMonday: string): string {
  return addDays(anchorMonday, 7);
}

export function formatDdMm(ymd: string): string {
  const [, m, d] = ymd.split("-");
  return `${d}.${m}`;
}
