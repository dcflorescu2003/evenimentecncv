export const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizeTimeInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function isValidTime24h(value: string): boolean {
  return TIME_24H_REGEX.test(value);
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
 * Formats a datetime string (ISO) to dd.mm.yyyy HH:MM
 */
export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return "—";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  const day = String(d.getDate()).padStart(2, "0");
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const year = d.getFullYear();
  const hours = String(d.getHours()).padStart(2, "0");
  const minutes = String(d.getMinutes()).padStart(2, "0");
  return `${day}.${month}.${year} ${hours}:${minutes}`;
}
