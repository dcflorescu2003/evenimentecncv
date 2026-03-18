-- Add max_hours column to class_participation_rules
ALTER TABLE public.class_participation_rules 
ADD COLUMN max_hours integer DEFAULT NULL;

-- Update get_student_progress to return required_hours and max_hours separately
CREATE OR REPLACE FUNCTION public.get_student_progress(_student_id uuid, _session_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _reserved_hours integer;
  _validated_hours integer;
  _required_hours integer;
  _cap_hours integer;
  _class_id uuid;
BEGIN
  SELECT COALESCE(sum(e.counted_duration_hours), 0) INTO _reserved_hours
  FROM reservations r
  JOIN events e ON e.id = r.event_id
  WHERE r.student_id = _student_id
    AND r.status = 'reserved'
    AND e.session_id = _session_id;

  SELECT COALESCE(sum(e.counted_duration_hours), 0) INTO _validated_hours
  FROM reservations r
  JOIN events e ON e.id = r.event_id
  JOIN tickets t ON t.reservation_id = r.id
  WHERE r.student_id = _student_id
    AND e.session_id = _session_id
    AND t.status IN ('present', 'late');

  SELECT class_id INTO _class_id FROM student_class_assignments
    WHERE student_id = _student_id ORDER BY created_at DESC LIMIT 1;

  _required_hours := 0;
  _cap_hours := NULL;

  IF _class_id IS NOT NULL THEN
    SELECT cpr.required_value, cpr.max_hours INTO _required_hours, _cap_hours 
    FROM class_participation_rules cpr
    WHERE cpr.class_id = _class_id AND cpr.session_id = _session_id LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'reserved_hours', _reserved_hours,
    'validated_hours', _validated_hours,
    'max_hours', COALESCE(_required_hours, 0),
    'required_hours', COALESCE(_required_hours, 0),
    'cap_hours', _cap_hours
  );
END;
$function$;

-- Update check_booking_eligibility to use max_hours as cap
CREATE OR REPLACE FUNCTION public.check_booking_eligibility(_student_id uuid, _event_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _event record;
  _student_class_id uuid;
  _student_grade int;
  _existing_reservation record;
  _reserved_count int;
  _public_count int;
  _total_count int;
  _overlapping record;
  _rule record;
  _current_reserved_hours int;
BEGIN
  SELECT * INTO _event FROM events WHERE id = _event_id;
  IF _event IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Evenimentul nu a fost găsit');
  END IF;

  IF _event.status != 'published' OR _event.published = false THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Evenimentul nu este disponibil pentru înscriere');
  END IF;

  IF _event.booking_open_at IS NOT NULL AND now() < _event.booking_open_at THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 
      'Înscrierile nu sunt deschise încă. Perioada de rezervare: ' || 
      to_char(_event.booking_open_at AT TIME ZONE 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI') || 
      ' – ' || 
      COALESCE(to_char(_event.booking_close_at AT TIME ZONE 'Europe/Bucharest', 'DD.MM.YYYY HH24:MI'), 'nedefinit')
    );
  END IF;
  IF _event.booking_close_at IS NOT NULL AND now() > _event.booking_close_at THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Înscrierile s-au închis');
  END IF;

  SELECT * INTO _existing_reservation FROM reservations 
  WHERE student_id = _student_id AND event_id = _event_id AND status = 'reserved';
  IF _existing_reservation IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Ai deja o rezervare pentru acest eveniment');
  END IF;

  SELECT count(*) INTO _reserved_count FROM reservations 
  WHERE event_id = _event_id AND status = 'reserved';
  
  SELECT count(*) INTO _public_count FROM public_tickets pt
  JOIN public_reservations pr ON pr.id = pt.public_reservation_id
  WHERE pr.event_id = _event_id AND pr.status = 'confirmed' AND pt.status != 'cancelled';
  
  _total_count := _reserved_count + _public_count;
  
  IF _total_count >= _event.max_capacity THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Nu mai sunt locuri disponibile');
  END IF;

  SELECT class_id INTO _student_class_id FROM student_class_assignments 
  WHERE student_id = _student_id ORDER BY created_at DESC LIMIT 1;

  IF _event.eligible_classes IS NOT NULL AND array_length(_event.eligible_classes, 1) > 0 THEN
    IF _student_class_id IS NULL OR NOT (_student_class_id::text = ANY(_event.eligible_classes)) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Nu ești eligibil pentru acest eveniment (restricție de clasă)');
    END IF;
  ELSIF _event.eligible_grades IS NOT NULL AND array_length(_event.eligible_grades, 1) > 0 THEN
    SELECT grade_number INTO _student_grade FROM classes WHERE id = _student_class_id;
    IF _student_grade IS NULL OR NOT (_student_grade = ANY(_event.eligible_grades)) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Nu ești eligibil pentru acest eveniment (restricție de an)');
    END IF;
  END IF;

  SELECT e.title INTO _overlapping FROM reservations r
  JOIN events e ON e.id = r.event_id
  WHERE r.student_id = _student_id AND r.status = 'reserved'
    AND e.date = _event.date
    AND e.start_time < _event.end_time AND e.end_time > _event.start_time
  LIMIT 1;
  IF _overlapping IS NOT NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Ai deja o rezervare care se suprapune: ' || _overlapping.title);
  END IF;

  -- Check max_hours cap from participation rules
  IF _student_class_id IS NOT NULL THEN
    SELECT * INTO _rule FROM class_participation_rules
    WHERE class_id = _student_class_id AND session_id = _event.session_id LIMIT 1;
    
    IF _rule IS NOT NULL AND _rule.max_hours IS NOT NULL AND _rule.max_hours > 0 THEN
      SELECT COALESCE(sum(e.counted_duration_hours), 0) INTO _current_reserved_hours
      FROM reservations r
      JOIN events e ON e.id = r.event_id
      WHERE r.student_id = _student_id
        AND r.status = 'reserved'
        AND e.session_id = _event.session_id;
      
      IF _current_reserved_hours + _event.counted_duration_hours > _rule.max_hours THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 
          'Ai atins limita maximă de ore (' || _rule.max_hours || 'h) pentru această sesiune');
      END IF;
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true);
END;
$function$;