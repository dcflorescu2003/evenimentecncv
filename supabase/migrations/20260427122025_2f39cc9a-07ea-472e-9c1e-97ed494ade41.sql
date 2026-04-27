-- Pasul 1: Anulez rezervările peste primii 5 per clasă pentru cele 2 meciuri
WITH ranked AS (
  SELECT r.id,
    ROW_NUMBER() OVER (PARTITION BY r.event_id, sca.class_id ORDER BY r.created_at ASC) AS rn
  FROM public.reservations r
  JOIN public.student_class_assignments sca ON sca.student_id = r.student_id
  WHERE r.event_id IN (
    '753dea88-65fe-455e-aed0-ecf174f79bf3',
    '5b975ee9-f0d4-454d-b2e3-47fc719f9f58'
  )
    AND r.status = 'reserved'
)
UPDATE public.reservations
SET status = 'cancelled', cancelled_at = now()
WHERE id IN (SELECT id FROM ranked WHERE rn > 5);

-- Pasul 2: Adaug verificarea hard în check_booking_eligibility
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
  _is_assistant boolean;
  _class_count int;
BEGIN
  SELECT * INTO _event FROM events WHERE id = _event_id;
  IF _event IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Evenimentul nu a fost găsit');
  END IF;

  IF _event.status != 'published' OR _event.published = false THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Evenimentul nu este disponibil pentru înscriere');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM event_student_assistants
    WHERE student_id = _student_id AND event_id = _event_id
  ) INTO _is_assistant;
  IF _is_assistant THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Ești deja asistent la acest eveniment');
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
  WHERE pr.event_id = _event_id AND pr.status = 'reserved' AND pt.status != 'cancelled';
  
  _total_count := _reserved_count + _public_count;
  
  IF _total_count >= _event.max_capacity THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Nu mai sunt locuri disponibile');
  END IF;

  SELECT class_id INTO _student_class_id FROM student_class_assignments 
  WHERE student_id = _student_id ORDER BY created_at DESC LIMIT 1;

  -- HARD LIMIT: 5 elevi per clasă pentru meciurile 28.04 și 29.04
  IF _event_id IN (
    '753dea88-65fe-455e-aed0-ecf174f79bf3'::uuid,
    '5b975ee9-f0d4-454d-b2e3-47fc719f9f58'::uuid
  ) AND _student_class_id IS NOT NULL THEN
    SELECT count(*) INTO _class_count
    FROM reservations r
    JOIN student_class_assignments sca ON sca.student_id = r.student_id
    WHERE r.event_id = _event_id
      AND r.status = 'reserved'
      AND sca.class_id = _student_class_id;
    IF _class_count >= 5 THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 
        'Clasa ta a atins limita de 5 locuri pentru acest eveniment');
    END IF;
  END IF;

  IF _event.eligible_classes IS NOT NULL AND array_length(_event.eligible_classes, 1) > 0 THEN
    IF _student_class_id IS NULL OR NOT (_student_class_id::text = ANY(CAST(_event.eligible_classes AS text[]))) THEN
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