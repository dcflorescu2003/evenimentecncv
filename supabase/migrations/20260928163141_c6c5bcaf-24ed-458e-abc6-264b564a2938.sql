CREATE OR REPLACE FUNCTION public.homeroom_can_enroll(_actor uuid, _student uuid, _event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.student_class_assignments sca
    JOIN public.classes c ON c.id = sca.class_id
    JOIN public.events e ON e.id = _event_id
    WHERE sca.student_id = _student AND c.homeroom_teacher_id = _actor
      AND e.is_public = false AND e.published = true
      AND e.status = 'published'::public.event_status
      AND (e.date > (now() AT TIME ZONE 'Europe/Bucharest')::date
           OR (e.date = (now() AT TIME ZONE 'Europe/Bucharest')::date AND e.start_time > (now() AT TIME ZONE 'Europe/Bucharest')::time))
      AND (c.id::text = ANY(COALESCE(e.eligible_classes::text[], '{}'))
           OR c.grade_number::text = ANY(COALESCE(e.eligible_grades::text[], '{}')))
  )
$$;
REVOKE ALL ON FUNCTION public.homeroom_can_enroll(uuid,uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.homeroom_can_enroll(uuid,uuid,uuid) TO authenticated, service_role;

DO $do$
DECLARE d text;
BEGIN
  d := pg_get_functiondef('public.manually_enroll_event_student'::regproc);
  d := replace(d, 'OR public.is_coordinator_for_event(_event_id, _actor_id)
  ) THEN', 'OR public.is_coordinator_for_event(_event_id, _actor_id)
    OR public.homeroom_can_enroll(_actor_id, _student_id, _event_id)
  ) THEN');
  IF position('homeroom_can_enroll' in d) = 0 THEN RAISE EXCEPTION 'patch failed'; END IF;
  EXECUTE d;
END $do$;

CREATE OR REPLACE FUNCTION public.list_enrollable_events_for_student(_student_id uuid, _session_id uuid)
RETURNS TABLE(id uuid, title text, date date, start_time time, end_time time, location text, counted_duration_hours int, free_seats int)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT e.id, e.title, e.date, e.start_time, e.end_time, e.location, e.counted_duration_hours,
    (e.max_capacity - (SELECT count(*) FROM public.reservations r WHERE r.event_id = e.id AND r.status='reserved'))::int
  FROM public.events e
  WHERE e.session_id = _session_id
    AND (public.homeroom_can_enroll(auth.uid(), _student_id, e.id)
         OR (public.has_role(auth.uid(),'admin') AND e.status='published' AND e.date >= current_date AND e.is_public=false))
    AND e.max_capacity > (SELECT count(*) FROM public.reservations r WHERE r.event_id = e.id AND r.status='reserved')
    AND NOT EXISTS (SELECT 1 FROM public.reservations r WHERE r.event_id=e.id AND r.student_id=_student_id AND r.status='reserved')
    AND NOT EXISTS (SELECT 1 FROM public.event_student_assistants a WHERE a.event_id=e.id AND a.student_id=_student_id)
    AND NOT EXISTS (
      SELECT 1 FROM public.reservations r JOIN public.events o ON o.id=r.event_id
      WHERE r.student_id=_student_id AND r.status='reserved' AND o.id<>e.id AND o.date=e.date
        AND o.start_time < e.end_time AND o.end_time > e.start_time)
  ORDER BY e.date, e.start_time
$$;
REVOKE ALL ON FUNCTION public.list_enrollable_events_for_student(uuid,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.list_enrollable_events_for_student(uuid,uuid) TO authenticated, service_role;