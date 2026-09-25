CREATE OR REPLACE FUNCTION public.can_view_internal_event(_user_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.events e
    WHERE e.id = _event_id
      AND e.published = true
      AND e.status IN ('published'::public.event_status, 'closed'::public.event_status)
      AND e.is_public = false
      AND (
        public.has_role(_user_id, 'admin'::public.app_role)
        OR public.has_role(_user_id, 'teacher'::public.app_role)
        OR public.has_role(_user_id, 'homeroom_teacher'::public.app_role)
        OR public.has_role(_user_id, 'coordinator_teacher'::public.app_role)
        OR public.has_role(_user_id, 'manager'::public.app_role)
        OR public.has_role(_user_id, 'cse'::public.app_role)
        OR EXISTS (
          SELECT 1 FROM public.reservations r
          WHERE r.event_id = e.id AND r.student_id = _user_id
        )
        OR EXISTS (
          SELECT 1 FROM public.event_student_assistants esa
          WHERE esa.event_id = e.id AND esa.student_id = _user_id
        )
        OR EXISTS (
          SELECT 1
          FROM public.student_class_assignments sca
          JOIN public.classes c ON c.id = sca.class_id
          WHERE sca.student_id = _user_id
            AND (
              (coalesce(array_length(e.eligible_classes, 1), 0) > 0 AND sca.class_id = ANY(e.eligible_classes))
              OR (
                coalesce(array_length(e.eligible_classes, 1), 0) = 0
                AND coalesce(array_length(e.eligible_grades, 1), 0) > 0
                AND c.grade_number = ANY(e.eligible_grades)
              )
            )
        )
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_view_internal_event(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.can_view_internal_event(uuid, uuid) TO authenticated, service_role;

DROP POLICY IF EXISTS "Authenticated read published events" ON public.events;
DROP POLICY IF EXISTS "Authenticated read closed events" ON public.events;

CREATE POLICY "Authenticated read visible published events"
ON public.events
FOR SELECT
TO authenticated
USING (
  (is_public = true AND published = true AND status = 'published'::public.event_status)
  OR public.can_view_internal_event(auth.uid(), id)
);

CREATE OR REPLACE FUNCTION public.search_students_for_event(
  _event_id uuid,
  _term text,
  _limit integer DEFAULT 30
)
RETURNS TABLE(id uuid, first_name text, last_name text, class_name text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
BEGIN
  IF auth.uid() IS NULL OR NOT (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR public.is_event_creator(_event_id, auth.uid())
    OR public.is_coordinator_for_event(_event_id, auth.uid())
  ) THEN
    RAISE EXCEPTION 'Nu aveți permisiunea de a căuta elevi pentru acest eveniment';
  END IF;

  RETURN QUERY
  SELECT p.id, p.first_name, p.last_name, c.display_name
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id AND ur.role = 'student'::public.app_role
  LEFT JOIN LATERAL (
    SELECT cls.display_name
    FROM public.student_class_assignments sca
    JOIN public.classes cls ON cls.id = sca.class_id
    WHERE sca.student_id = p.id
    ORDER BY sca.created_at DESC
    LIMIT 1
  ) c ON true
  WHERE p.is_active = true
    AND length(public.f_unaccent(coalesce(_term, ''))) >= 2
    AND (
      public.f_unaccent(p.last_name) LIKE '%' || public.f_unaccent(_term) || '%'
      OR public.f_unaccent(p.first_name) LIKE '%' || public.f_unaccent(_term) || '%'
      OR public.f_unaccent(p.last_name || ' ' || p.first_name) LIKE '%' || public.f_unaccent(_term) || '%'
      OR public.f_unaccent(p.first_name || ' ' || p.last_name) LIKE '%' || public.f_unaccent(_term) || '%'
      OR public.f_unaccent(coalesce(c.display_name, '')) LIKE '%' || public.f_unaccent(_term) || '%'
    )
  ORDER BY p.last_name COLLATE "ro-RO-x-icu", p.first_name COLLATE "ro-RO-x-icu"
  LIMIT greatest(1, least(coalesce(_limit, 30), 100));
END;
$$;

REVOKE ALL ON FUNCTION public.search_students_for_event(uuid, text, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.search_students_for_event(uuid, text, integer) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.manually_enroll_event_student(
  _event_id uuid,
  _student_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _actor_id uuid := auth.uid();
  _event public.events%ROWTYPE;
  _existing public.reservations%ROWTYPE;
  _reservation_id uuid;
  _ticket_id uuid;
  _active_count integer;
  _overlap_title text;
  _reactivated boolean := false;
BEGIN
  IF _actor_id IS NULL THEN
    RAISE EXCEPTION 'Autentificare necesară';
  END IF;

  IF NOT (
    public.has_role(_actor_id, 'admin'::public.app_role)
    OR public.is_event_creator(_event_id, _actor_id)
    OR public.is_coordinator_for_event(_event_id, _actor_id)
  ) THEN
    RAISE EXCEPTION 'Nu aveți permisiunea de a înscrie elevi la acest eveniment';
  END IF;

  SELECT * INTO _event FROM public.events WHERE id = _event_id FOR UPDATE;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Evenimentul nu a fost găsit');
  END IF;

  IF _event.status = 'cancelled'::public.event_status THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Evenimentul este anulat');
  END IF;

  IF NOT public.has_role(_student_id, 'student'::public.app_role)
     OR NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = _student_id AND p.is_active = true) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Elevul nu este activ');
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.event_student_assistants esa
    WHERE esa.event_id = _event_id AND esa.student_id = _student_id
  ) THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Elevul este deja asistent la acest eveniment');
  END IF;

  SELECT * INTO _existing
  FROM public.reservations r
  WHERE r.event_id = _event_id AND r.student_id = _student_id;

  IF FOUND AND _existing.status = 'reserved'::public.reservation_status THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Elevul este deja înscris');
  END IF;

  SELECT count(*) INTO _active_count
  FROM public.reservations r
  WHERE r.event_id = _event_id AND r.status = 'reserved'::public.reservation_status;

  IF _active_count >= _event.max_capacity THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Nu mai sunt locuri disponibile');
  END IF;

  SELECT e.title INTO _overlap_title
  FROM public.reservations r
  JOIN public.events e ON e.id = r.event_id
  WHERE r.student_id = _student_id
    AND r.status = 'reserved'::public.reservation_status
    AND e.id <> _event_id
    AND e.date = _event.date
    AND e.start_time < _event.end_time
    AND e.end_time > _event.start_time
  LIMIT 1;

  IF _overlap_title IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'Elevul are deja o rezervare care se suprapune: ' || _overlap_title);
  END IF;

  IF _existing.id IS NOT NULL THEN
    UPDATE public.reservations
    SET status = 'reserved'::public.reservation_status, cancelled_at = NULL
    WHERE id = _existing.id
    RETURNING id INTO _reservation_id;
    _reactivated := true;
  ELSE
    INSERT INTO public.reservations (event_id, student_id, status)
    VALUES (_event_id, _student_id, 'reserved'::public.reservation_status)
    RETURNING id INTO _reservation_id;
  END IF;

  INSERT INTO public.tickets (reservation_id, status, qr_code_data, checkin_timestamp)
  VALUES (_reservation_id, 'reserved'::public.ticket_status, gen_random_uuid()::text, NULL)
  ON CONFLICT (reservation_id) DO UPDATE
  SET status = 'reserved'::public.ticket_status,
      qr_code_data = gen_random_uuid()::text,
      checkin_timestamp = NULL,
      updated_at = now()
  RETURNING id INTO _ticket_id;

  INSERT INTO public.audit_logs (user_id, action, entity_type, entity_id, details)
  VALUES (
    _actor_id,
    'manual_enrollment',
    'reservation',
    _reservation_id,
    jsonb_build_object('event_id', _event_id, 'student_id', _student_id, 'reactivated', _reactivated)
  );

  INSERT INTO public.notifications (user_id, title, body, type, related_event_id)
  VALUES (
    _student_id,
    CASE WHEN _reactivated THEN 'Rezervare reactivată' ELSE 'Ai un bilet nou' END,
    'Ai fost înscris' || CASE WHEN _reactivated THEN ' din nou' ELSE '' END ||
      ' la „' || _event.title || '” (' || to_char(_event.date, 'DD.MM.YYYY') ||
      ', ora ' || to_char(_event.start_time, 'HH24:MI') || '). Biletul este disponibil în contul tău.',
    'manual_enrollment',
    _event_id
  );

  RETURN jsonb_build_object(
    'ok', true,
    'reactivated', _reactivated,
    'reservation_id', _reservation_id,
    'ticket_id', _ticket_id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.manually_enroll_event_student(uuid, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.manually_enroll_event_student(uuid, uuid) TO authenticated, service_role;