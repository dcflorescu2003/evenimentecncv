import { formatDate } from "@/lib/time";

type S = { id: string; start_date: string | null; end_date: string | null };

/** Returns an error message if date is outside the session's range, else null. */
export function sessionDateError(sessions: S[], sessionId: string | null | undefined, date: string): string | null {
  const s = sessions.find((x) => x.id === sessionId);
  if (!s || !s.start_date || !s.end_date || !date) return null;
  if (date < s.start_date || date > s.end_date) {
    return `Data trebuie să fie între ${formatDate(s.start_date)} și ${formatDate(s.end_date)} (perioada sesiunii)`;
  }
  return null;
}

export function sessionRangeLabel(sessions: S[], sessionId: string | null | undefined): string | null {
  const s = sessions.find((x) => x.id === sessionId);
  if (!s || !s.start_date || !s.end_date) return null;
  return `Perioada sesiunii: ${formatDate(s.start_date)} – ${formatDate(s.end_date)}`;
}
