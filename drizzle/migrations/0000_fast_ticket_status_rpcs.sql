CREATE INDEX IF NOT EXISTS idx_tickets_reservation_id ON public.tickets(reservation_id);
CREATE INDEX IF NOT EXISTS idx_reservations_event_id ON public.reservations(event_id);
CREATE INDEX IF NOT EXISTS idx_coordinator_assignments_event_teacher ON public.coordinator_assignments(event_id, teacher_id);

CREATE OR REPLACE FUNCTION public.set_ticket_attendance(_ticket_id uuid, _status ticket_status, _notes text DEFAULT NULL)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _prev ticket_status; _event uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Neautentificat'; END IF;
  SELECT t.status, r.event_id INTO _prev, _event FROM tickets t JOIN reservations r ON r.id = t.reservation_id WHERE t.id = _ticket_id;
  IF _event IS NULL THEN RAISE EXCEPTION 'Biletul nu a fost găsit'; END IF;
  IF NOT (has_role(_uid,'admin') OR is_event_creator(_event,_uid) OR is_coordinator_for_event(_event,_uid) OR is_assistant_for_event(_uid,_event)) THEN
    RAISE EXCEPTION 'Nu ai drepturi pentru acest eveniment';
  END IF;
  UPDATE tickets SET status = _status,
    checkin_timestamp = CASE WHEN _status IN ('present','late') THEN now() ELSE NULL END
  WHERE id = _ticket_id;
  INSERT INTO attendance_log(ticket_id, previous_status, new_status, changed_by, notes)
  VALUES (_ticket_id, _prev, _status, _uid, COALESCE(_notes,'Actualizat de profesor'));
END $$;

CREATE OR REPLACE FUNCTION public.cancel_event_reservation(_reservation_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _event uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Neautentificat'; END IF;
  SELECT event_id INTO _event FROM reservations WHERE id = _reservation_id;
  IF _event IS NULL THEN RAISE EXCEPTION 'Rezervarea nu a fost găsită'; END IF;
  IF NOT (has_role(_uid,'admin') OR is_event_creator(_event,_uid) OR is_coordinator_for_event(_event,_uid)) THEN
    RAISE EXCEPTION 'Nu ai drepturi pentru acest eveniment';
  END IF;
  UPDATE reservations SET status='cancelled', cancelled_at=now() WHERE id=_reservation_id;
  UPDATE tickets SET status='cancelled' WHERE reservation_id=_reservation_id;
  INSERT INTO audit_logs(user_id, action, entity_type, entity_id, details)
  VALUES (_uid,'reservation_cancelled','reservation',_reservation_id, jsonb_build_object('event_id',_event));
END $$;

REVOKE ALL ON FUNCTION public.set_ticket_attendance(uuid, ticket_status, text) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.cancel_event_reservation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_ticket_attendance(uuid, ticket_status, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.cancel_event_reservation(uuid) TO authenticated;