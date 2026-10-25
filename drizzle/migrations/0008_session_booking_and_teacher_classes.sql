ALTER TABLE public.program_sessions
  ADD COLUMN IF NOT EXISTS booking_open_at timestamptz,
  ADD COLUMN IF NOT EXISTS booking_close_at timestamptz,
  ADD COLUMN IF NOT EXISTS force_teacher_classes boolean NOT NULL DEFAULT false;

CREATE OR REPLACE FUNCTION public.apply_session_event_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s record; _cls uuid[];
BEGIN
  IF NEW.session_id IS NULL THEN RETURN NEW; END IF;
  SELECT booking_open_at, booking_close_at, force_teacher_classes INTO _s FROM program_sessions WHERE id = NEW.session_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF _s.booking_open_at IS NOT NULL THEN NEW.booking_open_at := _s.booking_open_at; END IF;
  IF _s.booking_close_at IS NOT NULL THEN NEW.booking_close_at := _s.booking_close_at; END IF;
  IF _s.force_teacher_classes AND NEW.created_by IS NOT NULL
     AND NOT has_role(NEW.created_by, 'admin') AND NOT coalesce(NEW.is_public, false) THEN
    SELECT array_agg(DISTINCT class_id) INTO _cls FROM portfolio_teacher_classes WHERE teacher_id = NEW.created_by;
    IF _cls IS NOT NULL THEN
      NEW.eligible_classes := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(NEW.eligible_classes, '{}'::uuid[]) || _cls) x);
    END IF;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_apply_session_event_rules ON public.events;
CREATE TRIGGER trg_apply_session_event_rules BEFORE INSERT OR UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.apply_session_event_rules();

CREATE OR REPLACE FUNCTION public.propagate_session_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF (NEW.booking_open_at IS DISTINCT FROM OLD.booking_open_at OR NEW.booking_close_at IS DISTINCT FROM OLD.booking_close_at)
     AND (NEW.booking_open_at IS NOT NULL OR NEW.booking_close_at IS NOT NULL) THEN
    UPDATE events SET booking_open_at = coalesce(NEW.booking_open_at, booking_open_at),
                      booking_close_at = coalesce(NEW.booking_close_at, booking_close_at)
     WHERE session_id = NEW.id;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_propagate_session_booking ON public.program_sessions;
CREATE TRIGGER trg_propagate_session_booking AFTER UPDATE ON public.program_sessions
  FOR EACH ROW EXECUTE FUNCTION public.propagate_session_booking();

CREATE OR REPLACE FUNCTION public.get_event_scan_roster(_event_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Neautentificat'; END IF;
  IF NOT (has_role(_uid,'admin') OR is_event_creator(_event_id,_uid) OR is_coordinator_for_event(_event_id,_uid) OR is_assistant_for_event(_uid,_event_id)) THEN
    RAISE EXCEPTION 'Nu ai drepturi pentru acest eveniment.';
  END IF;
  RETURN coalesce((
    SELECT jsonb_agg(x) FROM (
      SELECT t.id AS ticket_id, t.qr_code_data AS qr, t.status::text AS status, false AS is_public,
             trim(coalesce(p.last_name,'')||' '||coalesce(p.first_name,'')) AS name
        FROM reservations r JOIN tickets t ON t.reservation_id = r.id LEFT JOIN profiles p ON p.id = r.student_id
       WHERE r.event_id = _event_id AND r.status = 'reserved'
      UNION ALL
      SELECT pt.id, pt.qr_code_data, pt.status::text, true, pt.attendee_name || ' (Vizitator)'
        FROM public_reservations pr JOIN public_tickets pt ON pt.public_reservation_id = pr.id
       WHERE pr.event_id = _event_id
    ) x), '[]'::jsonb);
END $$;
REVOKE ALL ON FUNCTION public.get_event_scan_roster(uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_event_scan_roster(uuid) TO authenticated;

CREATE INDEX IF NOT EXISTS idx_ptc_teacher ON public.portfolio_teacher_classes(teacher_id);