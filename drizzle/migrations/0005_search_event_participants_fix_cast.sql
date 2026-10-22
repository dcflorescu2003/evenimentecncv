CREATE OR REPLACE FUNCTION public.search_event_participants(_event_id uuid, _q text)
RETURNS TABLE(ticket_id uuid, name text, status ticket_status, is_public boolean)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); q text := '%' || public.f_unaccent(lower(coalesce(_q,''))) || '%';
BEGIN
  IF uid IS NULL OR NOT (
    public.has_role(uid,'admin') OR public.is_event_creator(_event_id, uid)
    OR public.is_coordinator_for_event(_event_id, uid) OR public.is_assistant_for_event(uid, _event_id)
  ) THEN RETURN; END IF;
  IF length(trim(coalesce(_q,''))) < 2 THEN RETURN; END IF;
  RETURN QUERY
  SELECT * FROM (
    SELECT t.id, (p.last_name || ' ' || p.first_name)::text AS n, t.status, false
    FROM reservations r JOIN tickets t ON t.reservation_id = r.id JOIN profiles p ON p.id = r.student_id
    WHERE r.event_id = _event_id AND r.status = 'reserved'
      AND public.f_unaccent(lower(p.last_name || ' ' || p.first_name || ' ' || p.first_name || ' ' || p.last_name)) LIKE q
    UNION ALL
    SELECT pt.id, pt.attendee_name::text, pt.status::ticket_status, true
    FROM public_reservations pr JOIN public_tickets pt ON pt.public_reservation_id = pr.id
    WHERE pr.event_id = _event_id AND pr.status = 'reserved'
      AND public.f_unaccent(lower(pt.attendee_name)) LIKE q
  ) s ORDER BY 2 LIMIT 50;
END $$;