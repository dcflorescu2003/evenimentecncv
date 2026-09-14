
CREATE OR REPLACE FUNCTION public.qr_auto_status(_date date, _start_time time)
RETURNS public.club_attendance_status
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT CASE
    WHEN now() <= ((_date + _start_time) AT TIME ZONE 'Europe/Bucharest') + interval '15 minutes'
      THEN 'present'::public.club_attendance_status
    ELSE 'late'::public.club_attendance_status
  END
$$;

CREATE OR REPLACE FUNCTION public.parse_student_qr(_qr text)
RETURNS uuid
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public
AS $$
DECLARE
  v text;
BEGIN
  v := trim(coalesce(_qr, ''));
  IF v LIKE 'CNCV-STU:%' THEN
    v := substring(v from 10);
  END IF;
  BEGIN
    RETURN v::uuid;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_club_attendance_by_qr(_meeting_id uuid, _student_qr text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_club_id uuid;
  v_date date;
  v_start time;
  v_student uuid;
  v_name text;
  v_status public.club_attendance_status;
  v_existing public.club_attendance_status;
BEGIN
  SELECT club_id, date, start_time INTO v_club_id, v_date, v_start
  FROM public.club_meetings WHERE id = _meeting_id;
  IF v_club_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Întâlnirea nu există.');
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.is_club_coordinator(auth.uid(), v_club_id)
    OR public.is_club_creator(v_club_id, auth.uid())
    OR public.is_club_student_assistant(auth.uid(), v_club_id)
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nu ai dreptul să marchezi prezența la acest club.');
  END IF;

  v_student := public.parse_student_qr(_student_qr);
  IF v_student IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cod QR invalid.');
  END IF;

  SELECT coalesce(display_name, last_name || ' ' || first_name) INTO v_name
  FROM public.profiles WHERE id = v_student;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Elev negăsit.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.club_enrollments
    WHERE club_id = v_club_id AND student_id = v_student AND status = 'enrolled'
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', v_name || ' nu este membru aprobat al clubului.');
  END IF;

  SELECT status INTO v_existing FROM public.club_attendance
  WHERE meeting_id = _meeting_id AND student_id = v_student;
  IF v_existing IN ('present', 'late') THEN
    RETURN jsonb_build_object('success', false, 'already', true, 'name', v_name,
      'message', v_name || ' este deja marcat.');
  END IF;

  v_status := public.qr_auto_status(v_date, v_start);

  INSERT INTO public.club_attendance (meeting_id, student_id, status, checkin_at, marked_by)
  VALUES (_meeting_id, v_student, v_status, now(), auth.uid())
  ON CONFLICT (meeting_id, student_id) DO UPDATE
    SET status = EXCLUDED.status, checkin_at = EXCLUDED.checkin_at,
        marked_by = EXCLUDED.marked_by, updated_at = now();

  RETURN jsonb_build_object('success', true, 'name', v_name, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.mark_volunteer_attendance_by_qr(_day_id uuid, _student_qr text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_project_id uuid;
  v_date date;
  v_start time;
  v_student uuid;
  v_name text;
  v_status public.club_attendance_status;
  v_existing public.club_attendance_status;
BEGIN
  SELECT project_id, date, start_time INTO v_project_id, v_date, v_start
  FROM public.volunteer_days WHERE id = _day_id;
  IF v_project_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ziua de voluntariat nu există.');
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.is_volunteer_coordinator(auth.uid(), v_project_id)
    OR public.is_volunteer_creator(v_project_id, auth.uid())
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nu ai dreptul să marchezi prezența la acest proiect.');
  END IF;

  v_student := public.parse_student_qr(_student_qr);
  IF v_student IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cod QR invalid.');
  END IF;

  SELECT coalesce(display_name, last_name || ' ' || first_name) INTO v_name
  FROM public.profiles WHERE id = v_student;
  IF v_name IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Elev negăsit.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.volunteer_enrollments
    WHERE project_id = v_project_id AND student_id = v_student AND status = 'enrolled'
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', v_name || ' nu este înscris la acest proiect.');
  END IF;

  SELECT status INTO v_existing FROM public.volunteer_attendance
  WHERE day_id = _day_id AND student_id = v_student;
  IF v_existing IN ('present', 'late') THEN
    RETURN jsonb_build_object('success', false, 'already', true, 'name', v_name,
      'message', v_name || ' este deja marcat.');
  END IF;

  v_status := public.qr_auto_status(v_date, v_start);

  INSERT INTO public.volunteer_attendance (day_id, student_id, status, checkin_at, marked_by)
  VALUES (_day_id, v_student, v_status, now(), auth.uid())
  ON CONFLICT (day_id, student_id) DO UPDATE
    SET status = EXCLUDED.status, checkin_at = EXCLUDED.checkin_at,
        marked_by = EXCLUDED.marked_by, updated_at = now();

  RETURN jsonb_build_object('success', true, 'name', v_name, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.self_checkin_club(_qr_code_data text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_meeting_id uuid;
  v_club_id uuid;
  v_club_name text;
  v_date date;
  v_start time;
  v_status public.club_attendance_status;
  v_existing public.club_attendance_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Trebuie să fii autentificat.');
  END IF;

  SELECT m.id, m.club_id, c.name, m.date, m.start_time
  INTO v_meeting_id, v_club_id, v_club_name, v_date, v_start
  FROM public.club_meetings m
  JOIN public.clubs c ON c.id = m.club_id
  WHERE m.qr_code_data = trim(_qr_code_data);

  IF v_meeting_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cod QR necunoscut.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.club_enrollments
    WHERE club_id = v_club_id AND student_id = auth.uid() AND status = 'enrolled'
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nu ești membru aprobat al acestui club.');
  END IF;

  IF now() < ((v_date + v_start) AT TIME ZONE 'Europe/Bucharest') - interval '30 minutes' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Prea devreme pentru marcarea prezenței.');
  END IF;

  SELECT status INTO v_existing FROM public.club_attendance
  WHERE meeting_id = v_meeting_id AND student_id = auth.uid();
  IF v_existing IN ('present', 'late') THEN
    RETURN jsonb_build_object('success', false, 'already', true,
      'message', 'Prezența ta este deja înregistrată.');
  END IF;

  v_status := public.qr_auto_status(v_date, v_start);

  INSERT INTO public.club_attendance (meeting_id, student_id, status, checkin_at, marked_by)
  VALUES (v_meeting_id, auth.uid(), v_status, now(), auth.uid())
  ON CONFLICT (meeting_id, student_id) DO UPDATE
    SET status = EXCLUDED.status, checkin_at = EXCLUDED.checkin_at,
        marked_by = EXCLUDED.marked_by, updated_at = now();

  RETURN jsonb_build_object('success', true, 'name', v_club_name, 'status', v_status);
END;
$$;

CREATE OR REPLACE FUNCTION public.self_checkin_volunteer(_qr_code_data text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_day_id uuid;
  v_project_id uuid;
  v_project_name text;
  v_date date;
  v_start time;
  v_status public.club_attendance_status;
  v_existing public.club_attendance_status;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Trebuie să fii autentificat.');
  END IF;

  SELECT d.id, d.project_id, p.name, d.date, d.start_time
  INTO v_day_id, v_project_id, v_project_name, v_date, v_start
  FROM public.volunteer_days d
  JOIN public.volunteer_projects p ON p.id = d.project_id
  WHERE d.qr_code_data = trim(_qr_code_data);

  IF v_day_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Cod QR necunoscut.');
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM public.volunteer_enrollments
    WHERE project_id = v_project_id AND student_id = auth.uid() AND status = 'enrolled'
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nu ești înscris la acest proiect.');
  END IF;

  IF now() < ((v_date + v_start) AT TIME ZONE 'Europe/Bucharest') - interval '30 minutes' THEN
    RETURN jsonb_build_object('success', false, 'message', 'Prea devreme pentru marcarea prezenței.');
  END IF;

  SELECT status INTO v_existing FROM public.volunteer_attendance
  WHERE day_id = v_day_id AND student_id = auth.uid();
  IF v_existing IN ('present', 'late') THEN
    RETURN jsonb_build_object('success', false, 'already', true,
      'message', 'Prezența ta este deja înregistrată.');
  END IF;

  v_status := public.qr_auto_status(v_date, v_start);

  INSERT INTO public.volunteer_attendance (day_id, student_id, status, checkin_at, marked_by)
  VALUES (v_day_id, auth.uid(), v_status, now(), auth.uid())
  ON CONFLICT (day_id, student_id) DO UPDATE
    SET status = EXCLUDED.status, checkin_at = EXCLUDED.checkin_at,
        marked_by = EXCLUDED.marked_by, updated_at = now();

  RETURN jsonb_build_object('success', true, 'name', v_project_name, 'status', v_status);
END;
$$;
