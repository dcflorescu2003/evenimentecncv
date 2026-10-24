CREATE OR REPLACE FUNCTION public.list_student_events()
RETURNS SETOF public.events
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  WITH me AS (SELECT auth.uid() AS uid),
  my_classes AS (
    SELECT sca.class_id, c.grade_number
    FROM public.student_class_assignments sca
    JOIN public.classes c ON c.id = sca.class_id, me
    WHERE sca.student_id = me.uid
  )
  SELECT e.* FROM public.events e, me
  WHERE e.published = true AND e.status = 'published' AND e.is_public = false
    AND (
      EXISTS (SELECT 1 FROM public.reservations r WHERE r.event_id = e.id AND r.student_id = me.uid)
      OR EXISTS (SELECT 1 FROM public.event_student_assistants a WHERE a.event_id = e.id AND a.student_id = me.uid)
      OR EXISTS (SELECT 1 FROM my_classes mc WHERE
           (coalesce(array_length(e.eligible_classes,1),0) > 0 AND mc.class_id = ANY(e.eligible_classes))
        OR (coalesce(array_length(e.eligible_classes,1),0) = 0 AND coalesce(array_length(e.eligible_grades,1),0) > 0 AND mc.grade_number = ANY(e.eligible_grades)))
    )
  ORDER BY e.date DESC
$$;
REVOKE ALL ON FUNCTION public.list_student_events() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.list_student_events() TO authenticated;

CREATE OR REPLACE FUNCTION public.student_book_event(_event_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  _uid uuid := auth.uid();
  _elig jsonb;
  _res_id uuid;
  _status public.reservation_status;
  _reactivated boolean := false;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Neautentificat'; END IF;
  _elig := public.check_booking_eligibility(_uid, _event_id);
  IF NOT coalesce((_elig->>'allowed')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'reason', _elig->>'reason');
  END IF;

  SELECT id, status INTO _res_id, _status FROM public.reservations
   WHERE student_id = _uid AND event_id = _event_id FOR UPDATE;

  IF _res_id IS NOT NULL AND _status = 'reserved' THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Ai deja o rezervare pentru acest eveniment.');
  ELSIF _res_id IS NOT NULL THEN
    UPDATE public.reservations SET status = 'reserved', cancelled_at = NULL WHERE id = _res_id;
    UPDATE public.tickets SET status = 'reserved', qr_code_data = gen_random_uuid()::text, checkin_timestamp = NULL
     WHERE reservation_id = _res_id;
    _reactivated := true;
  ELSE
    INSERT INTO public.reservations (student_id, event_id) VALUES (_uid, _event_id) RETURNING id INTO _res_id;
  END IF;

  INSERT INTO public.tickets (reservation_id) VALUES (_res_id) ON CONFLICT (reservation_id) DO NOTHING;
  RETURN jsonb_build_object('ok', true, 'reservation_id', _res_id, 'reactivated', _reactivated);
END $$;
REVOKE ALL ON FUNCTION public.student_book_event(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_book_event(uuid) TO authenticated;

CREATE OR REPLACE FUNCTION public.student_cancel_reservation(_reservation_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
BEGIN
  UPDATE public.reservations SET status = 'cancelled', cancelled_at = now()
   WHERE id = _reservation_id AND student_id = auth.uid() AND status = 'reserved';
  IF NOT FOUND THEN RAISE EXCEPTION 'Rezervarea nu a fost găsită'; END IF;
  UPDATE public.tickets SET status = 'cancelled' WHERE reservation_id = _reservation_id;
END $$;
REVOKE ALL ON FUNCTION public.student_cancel_reservation(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.student_cancel_reservation(uuid) TO authenticated;