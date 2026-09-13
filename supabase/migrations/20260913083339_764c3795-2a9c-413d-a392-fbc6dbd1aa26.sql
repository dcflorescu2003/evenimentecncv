-- ============ ÎNTREBĂRI FORMULAR ============
CREATE TABLE public.club_form_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  question_type public.feedback_question_type NOT NULL,
  text text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  is_phone boolean NOT NULL DEFAULT false,
  options jsonb,
  scale_min integer,
  scale_max integer,
  scale_min_label text,
  scale_max_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_form_questions TO authenticated;
GRANT ALL ON public.club_form_questions TO service_role;
ALTER TABLE public.club_form_questions ENABLE ROW LEVEL SECURITY;

-- ============ DEPARTAMENTE ============
CREATE TABLE public.club_departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_departments TO authenticated;
GRANT ALL ON public.club_departments TO service_role;
ALTER TABLE public.club_departments ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.club_enrollments
  ADD COLUMN department_id uuid REFERENCES public.club_departments(id) ON DELETE SET NULL;

-- ============ ELEVI ASISTENȚI ============
CREATE TABLE public.club_student_assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (club_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_student_assistants TO authenticated;
GRANT ALL ON public.club_student_assistants TO service_role;
ALTER TABLE public.club_student_assistants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_club_student_assistant(_user_id uuid, _club_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_student_assistants
    WHERE club_id = _club_id AND student_id = _user_id
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_club_student_assistant(uuid, uuid) FROM anon;

CREATE OR REPLACE FUNCTION public.can_manage_club(_user_id uuid, _club_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.is_club_coordinator(_user_id, _club_id)
      OR public.is_club_creator(_club_id, _user_id)
      OR public.is_club_student_assistant(_user_id, _club_id)
$$;
REVOKE EXECUTE ON FUNCTION public.can_manage_club(uuid, uuid) FROM anon;

-- ============ RĂSPUNSURI LA FORMULAR ============
CREATE TABLE public.club_enrollment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.club_enrollments(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.club_form_questions(id) ON DELETE CASCADE,
  value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_enrollment_answers TO authenticated;
GRANT ALL ON public.club_enrollment_answers TO service_role;
ALTER TABLE public.club_enrollment_answers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_club_id_for_enrollment(_enrollment_id uuid)
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$ SELECT club_id FROM public.club_enrollments WHERE id = _enrollment_id $$;
REVOKE EXECUTE ON FUNCTION public.get_club_id_for_enrollment(uuid) FROM anon;

-- ============ POLITICI ============
CREATE POLICY "Staff manage club questions" ON public.club_form_questions
  FOR ALL TO authenticated
  USING (public.can_manage_club(auth.uid(), club_id))
  WITH CHECK (public.can_manage_club(auth.uid(), club_id));
CREATE POLICY "Authenticated read questions of active clubs" ON public.club_form_questions
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.status = 'active'));

CREATE POLICY "Staff manage club departments" ON public.club_departments
  FOR ALL TO authenticated
  USING (public.can_manage_club(auth.uid(), club_id))
  WITH CHECK (public.can_manage_club(auth.uid(), club_id));
CREATE POLICY "Authenticated read departments of active clubs" ON public.club_departments
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = club_id AND c.status = 'active'));

CREATE POLICY "Admins manage club assistants" ON public.club_student_assistants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Club owners manage assistants" ON public.club_student_assistants
  FOR ALL TO authenticated
  USING (public.is_club_creator(club_id, auth.uid()) OR public.is_club_coordinator(auth.uid(), club_id))
  WITH CHECK (public.is_club_creator(club_id, auth.uid()) OR public.is_club_coordinator(auth.uid(), club_id));
CREATE POLICY "Assistants read own assignment" ON public.club_student_assistants
  FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Manager read club assistants" ON public.club_student_assistants
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Staff read enrollment answers" ON public.club_enrollment_answers
  FOR SELECT TO authenticated
  USING (public.can_manage_club(auth.uid(), public.get_club_id_for_enrollment(enrollment_id)));
CREATE POLICY "Students read own answers" ON public.club_enrollment_answers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.club_enrollments e WHERE e.id = enrollment_id AND e.student_id = auth.uid()));

-- asistenți: drepturi pe membri, întâlniri, prezență, club
CREATE POLICY "Assistants read club" ON public.clubs
  FOR SELECT TO authenticated USING (public.is_club_student_assistant(auth.uid(), id));
CREATE POLICY "Assistants manage club enrollments" ON public.club_enrollments
  FOR ALL TO authenticated
  USING (public.is_club_student_assistant(auth.uid(), club_id))
  WITH CHECK (public.is_club_student_assistant(auth.uid(), club_id));
CREATE POLICY "Assistants manage club meetings" ON public.club_meetings
  FOR ALL TO authenticated
  USING (public.is_club_student_assistant(auth.uid(), club_id))
  WITH CHECK (public.is_club_student_assistant(auth.uid(), club_id));
CREATE POLICY "Assistants manage club attendance" ON public.club_attendance
  FOR ALL TO authenticated
  USING (public.is_club_student_assistant(auth.uid(), public.get_club_id_for_meeting(meeting_id)))
  WITH CHECK (public.is_club_student_assistant(auth.uid(), public.get_club_id_for_meeting(meeting_id)));
CREATE POLICY "Assistants read club coordinators" ON public.club_coordinators
  FOR SELECT TO authenticated USING (public.is_club_student_assistant(auth.uid(), club_id));

-- ============ ELIGIBILITATE CU APROBARE ============
CREATE OR REPLACE FUNCTION public.check_club_enrollment(_student_id uuid, _club_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  _club record;
  _class_id uuid;
  _grade int;
  _count int;
  _class_count int;
BEGIN
  SELECT * INTO _club FROM clubs WHERE id = _club_id;
  IF _club IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Clubul nu a fost găsit');
  END IF;
  IF _club.status <> 'active' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Clubul nu este activ');
  END IF;
  IF _club.enrollment_open_at IS NOT NULL AND now() < _club.enrollment_open_at THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Înscrierile nu sunt deschise încă');
  END IF;
  IF _club.enrollment_close_at IS NOT NULL AND now() > _club.enrollment_close_at THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Înscrierile s-au închis');
  END IF;
  IF EXISTS (SELECT 1 FROM club_enrollments WHERE club_id = _club_id AND student_id = _student_id AND status = 'enrolled') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Ești deja înscris la acest club');
  END IF;
  IF EXISTS (SELECT 1 FROM club_enrollments WHERE club_id = _club_id AND student_id = _student_id AND status = 'pending') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Ai deja o cerere în așteptare pentru acest club');
  END IF;
  IF _club.max_capacity IS NOT NULL THEN
    SELECT count(*) INTO _count FROM club_enrollments WHERE club_id = _club_id AND status = 'enrolled';
    IF _count >= _club.max_capacity THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Nu mai sunt locuri disponibile');
    END IF;
  END IF;
  SELECT class_id INTO _class_id FROM student_class_assignments
    WHERE student_id = _student_id ORDER BY created_at DESC LIMIT 1;
  IF _club.eligible_classes IS NOT NULL AND array_length(_club.eligible_classes, 1) > 0 THEN
    IF _class_id IS NULL OR NOT (_class_id::text = ANY(CAST(_club.eligible_classes AS text[]))) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Nu ești eligibil (restricție de clasă)');
    END IF;
  ELSIF _club.eligible_grades IS NOT NULL AND array_length(_club.eligible_grades, 1) > 0 THEN
    SELECT grade_number INTO _grade FROM classes WHERE id = _class_id;
    IF _grade IS NULL OR NOT (_grade = ANY(_club.eligible_grades)) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Nu ești eligibil (restricție de an)');
    END IF;
  END IF;
  IF _club.max_per_class IS NOT NULL AND _class_id IS NOT NULL THEN
    SELECT count(*) INTO _class_count
      FROM club_enrollments ce
      JOIN student_class_assignments sca ON sca.student_id = ce.student_id
      WHERE ce.club_id = _club_id AND ce.status = 'enrolled' AND sca.class_id = _class_id;
    IF _class_count >= _club.max_per_class THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Limita pentru clasa ta a fost atinsă');
    END IF;
  END IF;
  RETURN jsonb_build_object('allowed', true);
END;
$function$;

-- ============ TRIMITERE CERERE DE ÎNSCRIERE ============
CREATE OR REPLACE FUNCTION public.submit_club_enrollment(_club_id uuid, _answers jsonb DEFAULT '[]'::jsonb)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $function$
DECLARE
  _uid uuid := auth.uid();
  _check jsonb;
  _enrollment_id uuid;
  _q record;
  _val jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Trebuie să fii autentificat';
  END IF;
  IF NOT public.has_role(_uid, 'student') THEN
    RAISE EXCEPTION 'Doar elevii se pot înscrie';
  END IF;

  _check := public.check_club_enrollment(_uid, _club_id);
  IF NOT (_check->>'allowed')::boolean THEN
    RAISE EXCEPTION '%', COALESCE(_check->>'reason', 'Nu te poți înscrie');
  END IF;

  FOR _q IN SELECT id, required, text FROM club_form_questions WHERE club_id = _club_id LOOP
    IF _q.required THEN
      _val := _answers->(_q.id::text);
      IF _val IS NULL OR _val = 'null'::jsonb OR _val = '""'::jsonb OR _val = '[]'::jsonb THEN
        RAISE EXCEPTION 'Răspuns obligatoriu lipsă: %', _q.text;
      END IF;
    END IF;
  END LOOP;

  INSERT INTO club_enrollments (club_id, student_id, status)
  VALUES (_club_id, _uid, 'pending')
  RETURNING id INTO _enrollment_id;

  INSERT INTO club_enrollment_answers (enrollment_id, question_id, value)
  SELECT _enrollment_id, q.id, _answers->(q.id::text)
  FROM club_form_questions q
  WHERE q.club_id = _club_id AND _answers ? q.id::text;

  RETURN _enrollment_id;
END;
$function$;
REVOKE EXECUTE ON FUNCTION public.submit_club_enrollment(uuid, jsonb) FROM anon;

CREATE TRIGGER club_form_questions_updated_at BEFORE UPDATE ON public.club_form_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER club_departments_updated_at BEFORE UPDATE ON public.club_departments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();