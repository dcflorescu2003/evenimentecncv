import { supabase } from "@/integrations/supabase/client";

export interface CoordConflict {
  event_id: string;
  title: string;
  date: string;
  start_time: string;
  end_time: string;
}

function fmtDate(d: string) {
  const [y, m, day] = d.split("-");
  return `${day}.${m}.${y}`;
}

export async function getCoordinatorConflicts(
  teacherId: string,
  date: string,
  start: string,
  end: string,
  excludeEventId?: string | null,
): Promise<CoordConflict[]> {
  if (!date || !start || !end) return [];
  const { data, error } = await (supabase.rpc as any)("get_coordinator_conflicts", {
    _teacher_id: teacherId,
    _date: date,
    _start: start,
    _end: end,
    _exclude_event_id: excludeEventId ?? null,
  });
  if (error) return [];
  return (data ?? []) as CoordConflict[];
}

/** Returns true if the user confirmed (or there was no conflict). */
export async function confirmIfCoordinatorConflicts(
  teacherId: string,
  teacherName: string,
  date: string,
  start: string,
  end: string,
  excludeEventId?: string | null,
): Promise<boolean> {
  const conflicts = await getCoordinatorConflicts(teacherId, date, start, end, excludeEventId);
  if (conflicts.length === 0) return true;
  const lines = conflicts
    .map((c) => `• „${c.title}" pe ${fmtDate(c.date)}, ${c.start_time.slice(0, 5)}–${c.end_time.slice(0, 5)}`)
    .join("\n");
  return window.confirm(
    `Atenție: ${teacherName} are deja un eveniment care se suprapune:\n${lines}\n\nAdaugi oricum?`,
  );
}

export async function notifyCoordinatorAdded(teacherId: string, eventId: string, eventTitle: string) {
  const body = `Ai fost adăugat coordonator la „${eventTitle}". Dacă nu poți participa, poți renunța din pagina evenimentului.`;
  try {
    await supabase.from("notifications").insert({
      user_id: teacherId,
      title: "Ai fost adăugat coordonator",
      body,
      type: "coordinator_added",
      related_event_id: eventId,
    });
    await supabase.functions.invoke("send-push-to-user", {
      body: { user_id: teacherId, title: "Ai fost adăugat coordonator", body, url: `/prof/events/${eventId}` },
    });
  } catch {
    /* best-effort */
  }
}

export async function leaveCoordination(eventId: string, reason: string) {
  const { data, error } = await (supabase.rpc as any)("leave_event_coordination", {
    _event_id: eventId,
    _reason: reason || null,
  });
  if (error) throw error;
  const organizerId = data as string | null;
  if (organizerId) {
    try {
      await supabase.functions.invoke("send-push-to-user", {
        body: {
          user_id: organizerId,
          title: "Coordonator retras",
          body: "Un coordonator a renunțat la evenimentul tău.",
          url: `/prof/events/${eventId}`,
        },
      });
    } catch {
      /* best-effort */
    }
  }
}
