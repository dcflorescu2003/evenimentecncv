export const TIME_24H_REGEX = /^([01]\d|2[0-3]):([0-5]\d)$/;

export function normalizeTimeInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 4);
  if (digits.length <= 2) return digits;
  return `${digits.slice(0, 2)}:${digits.slice(2)}`;
}

export function isValidTime24h(value: string): boolean {
  return TIME_24H_REGEX.test(value);
}
