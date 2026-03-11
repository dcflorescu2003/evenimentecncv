
-- Function to check if a student can book an event
-- Returns JSON with { allowed: boolean, reason: string, current_hours: int, max_hours: int }
CREATE OR REPLACE FUNCTION public.check_booking_eligibility(
  _student_id uuid,
  _event_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _event events%ROWTYPE;
  _class_id uuid;
  _rule class_participation_rules%ROWTYPE;
  _current_hours integer;
  _overlap_count integer;
  _existing_reservation integer;
  _reserved_count integer;
BEGIN
  -- Get event
  SELECT * INTO _event FROM events WHERE id = _event_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Evenimentul nu există');
  END IF;

  -- Check event is published and bookable
  IF _event.status <> 'published' OR _event.published = false THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Evenimentul nu este publicat');
  END IF;

  -- Check booking window
  IF _event.booking_open_at IS NOT NULL AND now() < _event.booking_open_at THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Înscrierile nu sunt deschise încă');
  END IF;
  IF _event.booking_close_at IS NOT NULL AND now() > _event.booking_close_at THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Înscrierile s-au închis');
  END IF;

  -- Check capacity
  SELECT count(*) INTO _reserved_count FROM reservations
    WHERE event_id = _event_id AND status = 'reserved';
  IF _reserved_count >= _event.max_capacity THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Evenimentul este complet');
  END IF;

  -- Check if already reserved
  SELECT count(*) INTO _existing_reservation FROM reservations
    WHERE event_id = _event_id AND student_id = _student_id AND status = 'reserved';
  IF _existing_reservation > 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Ai deja o rezervare activă pentru acest eveniment');
  END IF;

  -- Get student class
  SELECT class_id INTO _class_id FROM student_class_assignments
    WHERE student_id = _student_id
    ORDER BY created_at DESC LIMIT 1;

  -- Check grade eligibility
  IF _class_id IS NOT NULL AND _event.eligible_grades IS NOT NULL AND array_length(_event.eligible_grades, 1) > 0 THEN
    DECLARE _grade integer;
    BEGIN
      SELECT grade_number INTO _grade FROM classes WHERE id = _class_id;
      IF _grade IS NOT NULL AND NOT (_grade = ANY(_event.eligible_grades)) THEN
        RETURN jsonb_build_object('allowed', false, 'reason', 'Clasa ta nu este eligibilă pentru acest eveniment');
      END IF;
    END;
  END IF;

  -- Check time overlap with existing reservations
  SELECT count(*) INTO _overlap_count
  FROM reservations r
  JOIN events e ON e.id = r.event_id
  WHERE r.student_id = _student_id
    AND r.status = 'reserved'
    AND e.date = _event.date
    AND e.start_time < _event.end_time
    AND e.end_time > _event.start_time;
  IF _overlap_count > 0 THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Ai deja o rezervare care se suprapune cu acest interval orar');
  END IF;

  -- Check hour limit
  IF _class_id IS NOT NULL THEN
    SELECT * INTO _rule FROM class_participation_rules
      WHERE class_id = _class_id AND session_id = _event.session_id
      LIMIT 1;

    IF FOUND THEN
      SELECT COALESCE(sum(ev.counted_duration_hours), 0) INTO _current_hours
      FROM reservations res
      JOIN events ev ON ev.id = res.event_id
      WHERE res.student_id = _student_id
        AND res.status = 'reserved'
        AND ev.session_id = _event.session_id;

      IF (_current_hours + _event.counted_duration_hours) > _rule.required_value THEN
        RETURN jsonb_build_object(
          'allowed', false,
          'reason', format('Depășești limita de ore. Ai %s din %s ore. Acest eveniment are %s ore.',
            _current_hours, _rule.required_value, _event.counted_duration_hours),
          'current_hours', _current_hours,
          'max_hours', _rule.required_value
        );
      END IF;

      RETURN jsonb_build_object('allowed', true, 'reason', 'OK', 'current_hours', _current_hours, 'max_hours', _rule.required_value);
    END IF;
  END IF;

  RETURN jsonb_build_object('allowed', true, 'reason', 'OK');
END;
$$;

-- Function to get student progress for a session
CREATE OR REPLACE FUNCTION public.get_student_progress(
  _student_id uuid,
  _session_id uuid
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _reserved_hours integer;
  _validated_hours integer;
  _max_hours integer;
  _class_id uuid;
BEGIN
  -- Get reserved hours (active reservations)
  SELECT COALESCE(sum(e.counted_duration_hours), 0) INTO _reserved_hours
  FROM reservations r
  JOIN events e ON e.id = r.event_id
  WHERE r.student_id = _student_id
    AND r.status = 'reserved'
    AND e.session_id = _session_id;

  -- Get validated hours (present or late tickets)
  SELECT COALESCE(sum(e.counted_duration_hours), 0) INTO _validated_hours
  FROM reservations r
  JOIN events e ON e.id = r.event_id
  JOIN tickets t ON t.reservation_id = r.id
  WHERE r.student_id = _student_id
    AND e.session_id = _session_id
    AND t.status IN ('present', 'late');

  -- Get max hours from class rule
  SELECT class_id INTO _class_id FROM student_class_assignments
    WHERE student_id = _student_id ORDER BY created_at DESC LIMIT 1;

  IF _class_id IS NOT NULL THEN
    SELECT required_value INTO _max_hours FROM class_participation_rules
      WHERE class_id = _class_id AND session_id = _session_id LIMIT 1;
  END IF;

  RETURN jsonb_build_object(
    'reserved_hours', _reserved_hours,
    'validated_hours', _validated_hours,
    'max_hours', COALESCE(_max_hours, 0)
  );
END;
$$;
