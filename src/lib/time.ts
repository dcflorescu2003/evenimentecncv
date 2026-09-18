import { z } from "zod";

export const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;
export const time24hSchema = z.string().regex(TIME_24H_REGEX, "Ora trebuie să fie în format HH:MM (00:00–23:59)");

export function normalizeTimeInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function isValidTime24h(value: string): boolean {
  return time24hSchema.safeParse(value).success;
}

export function formatTime(value: string | null | undefined): string {
  if (!value) return "—";
  const match = value.match(/^(\d{2}):(\d{2})/);
  return match ? `${match[1]}:${match[2]}` : value;
}

/**
 * Formats a date string (yyyy-mm-dd or ISO) to dd.mm.yyyy
 */
export function formatDate(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  // Handle yyyy-mm-dd format
  const match = dateStr.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (match) {
    return `${match[3]}.${match[2]}.${match[1]}`;
  }
  return dateStr;
}

/**
 * Formats a datetime string (ISO) to dd.mm.yyyy HH:MM in Europe/Bucharest
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const parts = new Intl.DateTimeFormat("ro-RO", {
    timeZone: "Europe/Bucharest",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(d);
  const get = (type: Intl.DateTimeFormatPartTypes) => parts.find((part) => part.type === type)?.value ?? "";
  return `${get("day")}.${get("month")}.${get("year")} ${get("hour")}:${get("minute")}`;
}

/**
 * Returns the Europe/Bucharest offset in hours for a given date string (yyyy-mm-dd).
 * EET = +2, EEST = +3
 */
export function getBucharestOffsetHours(dateStr: string): number {
  const utcProbe = new Date(`${dateStr}T12:00:00Z`);
  const bucharestStr = utcProbe.toLocaleString("sv-SE", { timeZone: "Europe/Bucharest" });
  const bucharestProbe = new Date(bucharestStr.replace(" ", "T"));
  const diffMs = bucharestProbe.getTime() - utcProbe.getTime();
  return Math.round(diffMs / 3600000);
}

/**
 * Combines a date (yyyy-mm-dd) and time (HH:MM) into an ISO datetime
 * explicitly anchored to Europe/Bucharest timezone.
 */
export function joinDatetime(date: string, time: string): string | null {
  if (!date) return null;
  const t = time || "00:00";
  const offsetHours = getBucharestOffsetHours(date);
  const sign = offsetHours >= 0 ? "+" : "-";
  const absHours = Math.abs(offsetHours);
  const offsetStr = `${sign}${String(absHours).padStart(2, "0")}:00`;
  return `${date}T${t}:00${offsetStr}`;
}

/**
 * Splits an ISO datetime back into date and time interpreted in Europe/Bucharest.
 */
export function splitDatetime(dt: string | null): { date: string; time: string } {
  if (!dt) return { date: "", time: "" };
  const d = new Date(dt);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  const roStr = d.toLocaleString("sv-SE", { timeZone: "Europe/Bucharest" });
  const [datePart, timePart] = roStr.split(" ");
  const [h, m] = timePart.split(":");
  return {
    date: datePart,
    time: `${h}:${m}`,
  };
}
