/**
 * Determines which events are considered "held" (desfășurate).
 * An event is held if:
 * 1. Its date is in the past
 * 2. It has at least one scanned ticket (status = 'present' or 'late')
 * 3. If minParticipants is set, it must have >= minParticipants scanned tickets
 */
export function getHeldEventIds(
  events: Array<{ id: string; date: string }>,
  ticketsByEvent: Record<string, number>, // event_id -> count of present/late tickets
  minParticipants?: number | null,
): Set<string> {
  const today = new Date().toISOString().slice(0, 10);
  const held = new Set<string>();
  const threshold = minParticipants && minParticipants > 0 ? minParticipants : 1;

  for (const e of events) {
    if (e.date >= today) continue;
    const scanned = ticketsByEvent[e.id] || 0;
    if (scanned >= threshold) {
      held.add(e.id);
    }
  }

  return held;
}
