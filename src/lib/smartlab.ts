/** Utilitare pentru modulul Smart Lab (rezervări echipamente VR). */

/** Orele de start disponibile: 07:30 → 18:30, din oră în oră. */
export const VR_SLOTS: string[] = Array.from({ length: 12 }, (_, i) =>
  `${String(7 + i).padStart(2, "0")}:30`,
);

export const VR_SUBJECTS = ["Istorie", "Biologie", "Chimie", "Geografie", "Fizică"] as const;

export function isoToDisplay(iso: string): string {
  const m = iso?.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  return m ? `${m[3]}.${m[2]}.${m[1]}` : iso ?? "";
}

export function dateToIso(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

export function todayIso(): string {
  return dateToIso(new Date());
}

/** Luni-ul săptămânii din care face parte data dată. */
export function startOfWeek(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = (copy.getDay() + 6) % 7; // 0 = luni
  copy.setDate(copy.getDate() - day);
  return copy;
}

export function addDays(d: Date, n: number): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  copy.setDate(copy.getDate() + n);
  return copy;
}

export const WEEKDAY_LABELS = ["Luni", "Marți", "Miercuri", "Joi", "Vineri"];

export function hhmm(t: string | null | undefined): string {
  return (t ?? "").slice(0, 5);
}
