import { supabase } from "@/integrations/supabase/client";

export type ScanTicketResult = {
  success: boolean;
  message?: string;
  already?: boolean;
  status?: string;
  name?: string;
  ticket_id?: string;
  is_public?: boolean;
};

const CONN_ERR = "Eroare de conexiune, încearcă din nou.";

/** Caută și marchează biletul într-un singur pas pe server (rapid, fără RLS lent). */
export async function scanEventTicket(eventId: string, qr: string): Promise<ScanTicketResult> {
  const { data, error } = await supabase.rpc("scan_event_ticket" as any, { _event_id: eventId, _qr: qr } as any);
  if (error) return { success: false, message: CONN_ERR };
  return (data ?? { success: false, message: CONN_ERR }) as ScanTicketResult;
}

/** Marchează manual prezența (elev sau vizitator) prin funcțiile securizate de pe server. */
export async function setAttendance(ticketId: string, status: string, isPublic?: boolean, notes?: string) {
  const { error } = isPublic
    ? await supabase.rpc("set_public_ticket_attendance" as any, { _ticket_id: ticketId, _status: status } as any)
    : await supabase.rpc("set_ticket_attendance" as any, { _ticket_id: ticketId, _status: status, _notes: notes ?? null } as any);
  return error ? error.message : null;
}

export type ParticipantHit = { ticket_id: string; name: string; status: string; is_public: boolean };

/** Caută participanții unui eveniment (elevi + vizitatori) printr-o funcție rapidă pe server. */
export async function searchEventParticipants(eventId: string, q: string): Promise<ParticipantHit[]> {
  const { data, error } = await supabase.rpc("search_event_participants" as any, { _event_id: eventId, _q: q } as any);
  if (error) throw new Error(CONN_ERR);
  return (data ?? []) as ParticipantHit[];
}

export type RosterEntry = ParticipantHit & { qr: string };

const rosterKey = (eventId: string) => `scan_roster_${eventId}`;
const queueKey = (eventId: string) => `scan_queue_${eventId}`;

/** Descarcă o singură dată lista biletelor evenimentului (pentru validare locală instantă). */
export async function fetchEventRoster(eventId: string): Promise<RosterEntry[]> {
  const { data, error } = await supabase.rpc("get_event_scan_roster" as any, { _event_id: eventId } as any);
  if (error) throw new Error(CONN_ERR);
  const list = (data ?? []) as RosterEntry[];
  try { localStorage.setItem(rosterKey(eventId), JSON.stringify(list)); } catch { /* plin */ }
  return list;
}

export function cachedRoster(eventId: string): RosterEntry[] | undefined {
  try { const s = localStorage.getItem(rosterKey(eventId)); return s ? JSON.parse(s) : undefined; } catch { return undefined; }
}

export function readQueue(eventId: string): string[] {
  try { return JSON.parse(localStorage.getItem(queueKey(eventId)) || "[]"); } catch { return []; }
}
export function writeQueue(eventId: string, q: string[]) {
  try { localStorage.setItem(queueKey(eventId), JSON.stringify(q)); } catch { /* ignore */ }
}

/** Statusul estimat local (serverul decide final): prezent până la +15 min de la început. */
export function localAutoStatus(date?: string | null, start?: string | null): "present" | "late" {
  if (!date || !start) return "present";
  const t = new Date(`${date}T${start.slice(0, 5)}:00`).getTime() + 15 * 60_000;
  return Date.now() <= t ? "present" : "late";
}
