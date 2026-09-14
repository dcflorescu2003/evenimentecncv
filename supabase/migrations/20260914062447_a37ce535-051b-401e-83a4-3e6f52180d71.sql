CREATE TABLE public.student_qr_tokens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  token text NOT NULL UNIQUE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.student_qr_tokens TO authenticated;
GRANT ALL ON public.student_qr_tokens TO service_role;

ALTER TABLE public.student_qr_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Students can view their own qr tokens"
ON public.student_qr_tokens FOR SELECT TO authenticated
USING (student_id = auth.uid());

CREATE INDEX idx_student_qr_tokens_student ON public.student_qr_tokens (student_id, expires_at DESC);

CREATE OR REPLACE FUNCTION public.issue_student_qr()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_expires timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Neautentificat.');
  END IF;

  DELETE FROM public.student_qr_tokens
  WHERE student_id = auth.uid() AND expires_at < now() - interval '5 minutes';

  v_token := replace(replace(replace(encode(gen_random_bytes(18), 'base64'), '+', 'A'), '/', 'B'), '=', '');
  v_expires := now() + interval '25 seconds';

  INSERT INTO public.student_qr_tokens (student_id, token, expires_at)
  VALUES (auth.uid(), v_token, v_expires);

  RETURN jsonb_build_object('success', true, 'token', v_token, 'expires_at', v_expires);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.issue_student_qr() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.issue_student_qr() TO authenticated;

CREATE OR REPLACE FUNCTION public.resolve_student_qr(_qr text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_token text;
  v_rec public.student_qr_tokens%ROWTYPE;
BEGIN
  IF _qr IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Cod QR invalid.');
  END IF;

  IF _qr LIKE 'CNCV-STU2:%' THEN
    v_token := substring(_qr from 11);
  ELSIF _qr LIKE 'CNCV-STU:%' THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Cod vechi, expirat. Elevul trebuie să deschidă din nou legitimația.');
  ELSE
    v_token := _qr;
  END IF;

  SELECT * INTO v_rec FROM public.student_qr_tokens WHERE token = v_token;
  IF v_rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Cod QR invalid.');
  END IF;
  IF v_rec.used_at IS NOT NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Cod deja folosit. Cere elevului codul curent.');
  END IF;
  IF v_rec.expires_at <= now() THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Cod expirat. Cere elevului codul curent.');
  END IF;

  RETURN jsonb_build_object('ok', true, 'student_id', v_rec.student_id, 'token', v_token);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.resolve_student_qr(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.resolve_student_qr(text) TO authenticated;

CREATE OR REPLACE FUNCTION public.parse_student_qr(_qr text)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v jsonb;
BEGIN
  v := public.resolve_student_qr(_qr);
  IF (v->>'ok')::boolean THEN
    RETURN (v->>'student_id')::uuid;
  END IF;
  RETURN NULL;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.parse_student_qr(text) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.parse_student_qr(text) TO authenticated;

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
  v_resolved jsonb;
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

  v_resolved := public.resolve_student_qr(_student_qr);
  IF NOT (v_resolved->>'ok')::boolean THEN
    RETURN jsonb_build_object('success', false, 'message', v_resolved->>'message');
  END IF;
  v_student := (v_resolved->>'student_id')::uuid;

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
    UPDATE public.student_qr_tokens SET used_at = now() WHERE token = v_resolved->>'token';
    RETURN jsonb_build_object('success', false, 'already', true, 'name', v_name,
      'message', v_name || ' este deja marcat.');
  END IF;

  v_status := public.qr_auto_status(v_date, v_start);

  INSERT INTO public.club_attendance (meeting_id, student_id, status, checkin_at, marked_by)
  VALUES (_meeting_id, v_student, v_status, now(), auth.uid())
  ON CONFLICT (meeting_id, student_id) DO UPDATE
    SET status = EXCLUDED.status, checkin_at = EXCLUDED.checkin_at,
        marked_by = EXCLUDED.marked_by, updated_at = now();

  UPDATE public.student_qr_tokens SET used_at = now() WHERE token = v_resolved->>'token';

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
  v_resolved jsonb;
BEGIN
  SELECT project_id, date, start_time INTO v_project_id, v_date, v_start
  FROM public.volunteer_days WHERE id = _day_id;
  IF v_project_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Ziua nu există.');
  END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR public.is_volunteer_coordinator(auth.uid(), v_project_id)
    OR public.is_volunteer_creator(v_project_id, auth.uid())
  ) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Nu ai dreptul să marchezi prezența la acest proiect.');
  END IF;

  v_resolved := public.resolve_student_qr(_student_qr);
  IF NOT (v_resolved->>'ok')::boolean THEN
    RETURN jsonb_build_object('success', false, 'message', v_resolved->>'message');
  END IF;
  v_student := (v_resolved->>'student_id')::uuid;

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
    UPDATE public.student_qr_tokens SET used_at = now() WHERE token = v_resolved->>'token';
    RETURN jsonb_build_object('success', false, 'already', true, 'name', v_name,
      'message', v_name || ' este deja marcat.');
  END IF;

  v_status := public.qr_auto_status(v_date, v_start);

  INSERT INTO public.volunteer_attendance (day_id, student_id, status, checkin_at, marked_by)
  VALUES (_day_id, v_student, v_status, now(), auth.uid())
  ON CONFLICT (day_id, student_id) DO UPDATE
    SET status = EXCLUDED.status, checkin_at = EXCLUDED.checkin_at,
        marked_by = EXCLUDED.marked_by, updated_at = now();

  UPDATE public.student_qr_tokens SET used_at = now() WHERE token = v_resolved->>'token';

  RETURN jsonb_build_object('success', true, 'name', v_name, 'status', v_status);
END;
$$;