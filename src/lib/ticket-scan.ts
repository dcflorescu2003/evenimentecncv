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
