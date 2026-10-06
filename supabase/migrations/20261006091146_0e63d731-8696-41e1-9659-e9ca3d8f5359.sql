CREATE OR REPLACE FUNCTION public.homeroom_can_enroll(_actor uuid, _student uuid, _event_id uuid)
 RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
  SELECT EXISTS (
    SELECT 1 FROM public.student_class_assignments sca
    JOIN public.classes c ON c.id = sca.class_id
    JOIN public.events e ON e.id = _event_id
    WHERE sca.student_id = _student AND c.homeroom_teacher_id = _actor
      AND e.is_public = false AND e.published = true
      AND e.status = 'published'::public.event_status
      AND (e.date > (now() AT TIME ZONE 'Europe/Bucharest')::date
           OR (e.date = (now() AT TIME ZONE 'Europe/Bucharest')::date AND e.start_time > (now() AT TIME ZONE 'Europe/Bucharest')::time))
      AND (
        (coalesce(array_length(e.eligible_classes,1),0) > 0 AND c.id::text = ANY(e.eligible_classes::text[]))
        OR (coalesce(array_length(e.eligible_classes,1),0) = 0 AND c.grade_number::text = ANY(COALESCE(e.eligible_grades::text[], '{}')))
      )
  )
$function$;