CREATE OR REPLACE FUNCTION public.get_student_progress(_student_id uuid, _session_id uuid)
 RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE
  _reserved_hours integer; _validated_hours integer; _required_hours integer; _cap_hours integer; _class_id uuid;
BEGIN
  SELECT COALESCE(sum(LEAST(4, d.h)), 0) INTO _reserved_hours FROM (
    SELECT e.date, sum(e.counted_duration_hours) h FROM reservations r JOIN events e ON e.id = r.event_id
    WHERE r.student_id = _student_id AND r.status = 'reserved' AND e.session_id = _session_id GROUP BY e.date) d;

  SELECT COALESCE(sum(LEAST(4, d.h)), 0) INTO _validated_hours FROM (
    SELECT e.date, sum(e.counted_duration_hours) h FROM reservations r JOIN events e ON e.id = r.event_id
    JOIN tickets t ON t.reservation_id = r.id
    WHERE r.student_id = _student_id AND e.session_id = _session_id AND t.status IN ('present','late') GROUP BY e.date) d;

  SELECT class_id INTO _class_id FROM student_class_assignments WHERE student_id = _student_id ORDER BY created_at DESC LIMIT 1;
  _required_hours := 0; _cap_hours := NULL;
  IF _class_id IS NOT NULL THEN
    SELECT cpr.required_value, cpr.max_hours INTO _required_hours, _cap_hours FROM class_participation_rules cpr
    WHERE cpr.class_id = _class_id AND cpr.session_id = _session_id LIMIT 1;
  END IF;
  RETURN jsonb_build_object('reserved_hours', _reserved_hours, 'validated_hours', _validated_hours,
    'max_hours', COALESCE(_required_hours,0), 'required_hours', COALESCE(_required_hours,0), 'cap_hours', _cap_hours);
END;
$function$;