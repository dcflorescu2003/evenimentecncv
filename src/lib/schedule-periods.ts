// Intervale fixe CNCV: 50 min cu pauze de 10 min, prima oră începe la 07:30,
// ultima oră (perioada 12) se încheie la 19:20.
export interface SchedulePeriod {
  period: number;
  start: string; // HH:MM
  end: string;   // HH:MM
}

export const PERIODS: SchedulePeriod[] = Array.from({ length: 12 }, (_, i) => {
  const startMinutes = 7 * 60 + 30 + i * 60; // start increments by 60 min
  const endMinutes = startMinutes + 50;
  const fmt = (m: number) =>
    `${String(Math.floor(m / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
  return { period: i + 1, start: fmt(startMinutes), end: fmt(endMinutes) };
});

export const DAYS: { value: number; label: string; short: string }[] = [
  { value: 1, label: "Luni", short: "L" },
  { value: 2, label: "Marți", short: "Ma" },
  { value: 3, label: "Miercuri", short: "Mi" },
  { value: 4, label: "Joi", short: "J" },
  { value: 5, label: "Vineri", short: "V" },
];

/** Returnează perioada activă în acest moment (în Europe/Bucharest local time), sau null. */
export function getCurrentPeriod(now: Date = new Date()): { period: number; day: number } | null {
  const day = now.getDay(); // 0=Sun..6=Sat
  if (day < 1 || day > 5) return null;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  for (const p of PERIODS) {
    const [sh, sm] = p.start.split(":").map(Number);
    const [eh, em] = p.end.split(":").map(Number);
    const s = sh * 60 + sm;
    const e = eh * 60 + em;
    if (nowMin >= s && nowMin < e) return { period: p.period, day };
  }
  return null;
}
