export interface DutyRow {
  week_slot: string;
  weekday: number;
  shift: string;
  teacher_id: string | null;
}

export function reminderContext(now: Date, anchor: string) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(now);
  const part = (key: string) => parts.find((p) => p.type === key)?.value ?? "";
  const today = `${part("year")}-${part("month")}-${part("day")}`;
  const tomorrow = new Date(`${today}T00:00:00Z`);
  tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
  const weekday = tomorrow.getUTCDay();
  const monday = new Date(tomorrow);
  monday.setUTCDate(monday.getUTCDate() + 1 - weekday);
  const weeks = Math.round((monday.getTime() - new Date(`${anchor}T00:00:00Z`).getTime()) / 604800000);
  return {
    date: tomorrow.toISOString().slice(0, 10), weekday,
    weekSlot: ((weeks % 2) + 2) % 2 === 0 ? "A" : "B",
    due: part("hour") === "15" && part("minute") === "00" && weekday >= 1 && weekday <= 5,
  };
}

export function dutyRecipients(rows: DutyRow[], context: ReturnType<typeof reminderContext>) {
  const teachers = new Map<string, Set<string>>();
  if (context.weekday < 1 || context.weekday > 5) return teachers;
  for (const row of rows) {
    if (!row.teacher_id || row.week_slot !== context.weekSlot || row.weekday !== context.weekday) continue;
    const shifts = teachers.get(row.teacher_id) ?? new Set<string>();
    shifts.add(row.shift);
    teachers.set(row.teacher_id, shifts);
  }
  return teachers;
}

export async function dutyNotificationId(teacherId: string, date: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`duty_reminder:${teacherId}:${date}`));
  const bytes = new Uint8Array(digest).slice(0, 16);
  bytes[6] = (bytes[6] & 15) | 80;
  bytes[8] = (bytes[8] & 63) | 128;
  const hex = Array.from(bytes, (b) => b.toString(16).padStart(2, "0")).join("");
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}