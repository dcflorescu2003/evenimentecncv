CREATE OR REPLACE FUNCTION public.can_manage_volunteer(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT public.has_role(_user_id,'admin')
    OR ((public.has_role(_user_id,'cse') OR public.has_role(_user_id,'teacher') OR public.has_role(_user_id,'homeroom_teacher'))
        AND public.is_volunteer_creator(_project_id,_user_id))
    OR public.is_volunteer_coordinator(_user_id,_project_id)
$$;

CREATE TABLE public.volunteer_form_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.volunteer_projects(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  question_type public.feedback_question_type NOT NULL,
  text text NOT NULL,
  required boolean NOT NULL DEFAULT true,
  options jsonb,
  scale_min int, scale_max int, scale_min_label text, scale_max_label text,
  is_phone boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.volunteer_form_questions TO authenticated;
GRANT ALL ON public.volunteer_form_questions TO service_role;
ALTER TABLE public.volunteer_form_questions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read questions of active projects" ON public.volunteer_form_questions
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM volunteer_projects p WHERE p.id = project_id AND p.status = 'active'));
CREATE POLICY "Staff manage volunteer questions" ON public.volunteer_form_questions
  FOR ALL TO authenticated USING (public.can_manage_volunteer(auth.uid(), project_id))
  WITH CHECK (public.can_manage_volunteer(auth.uid(), project_id));
CREATE TRIGGER trg_vfq_updated BEFORE UPDATE ON public.volunteer_form_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.volunteer_enrollment_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  enrollment_id uuid NOT NULL REFERENCES public.volunteer_enrollments(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.volunteer_form_questions(id) ON DELETE CASCADE,
  value jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (enrollment_id, question_id)
);
GRANT SELECT ON public.volunteer_enrollment_answers TO authenticated;
GRANT ALL ON public.volunteer_enrollment_answers TO service_role;
ALTER TABLE public.volunteer_enrollment_answers ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.get_project_id_for_volunteer_enrollment(_enrollment_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT project_id FROM volunteer_enrollments WHERE id = _enrollment_id
$$;

CREATE POLICY "Students read own volunteer answers" ON public.volunteer_enrollment_answers
  FOR SELECT TO authenticated USING (EXISTS (SELECT 1 FROM volunteer_enrollments e WHERE e.id = enrollment_id AND e.student_id = auth.uid()));
CREATE POLICY "Staff read volunteer answers" ON public.volunteer_enrollment_answers
  FOR SELECT TO authenticated USING (
    public.can_manage_volunteer(auth.uid(), public.get_project_id_for_volunteer_enrollment(enrollment_id))
    OR public.is_volunteer_student_assistant(auth.uid(), public.get_project_id_for_volunteer_enrollment(enrollment_id)));

CREATE OR REPLACE FUNCTION public.submit_volunteer_enrollment(_project_id uuid, _answers jsonb DEFAULT '{}'::jsonb)
RETURNS uuid LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _uid uuid := auth.uid(); _check jsonb; _eid uuid; _q record; _val jsonb;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Trebuie să fii autentificat'; END IF;
  IF NOT public.has_role(_uid,'student') THEN RAISE EXCEPTION 'Doar elevii se pot înscrie'; END IF;
  _check := public.check_volunteer_enrollment(_uid, _project_id);
  IF NOT COALESCE((_check->>'allowed')::boolean,false) THEN
    RAISE EXCEPTION '%', COALESCE(_check->>'reason','Nu te poți înscrie');
  END IF;
  FOR _q IN SELECT id, required, text FROM volunteer_form_questions WHERE project_id = _project_id LOOP
    IF _q.required THEN
      _val := _answers->(_q.id::text);
      IF _val IS NULL OR _val = 'null'::jsonb OR _val = '""'::jsonb OR _val = '[]'::jsonb THEN
        RAISE EXCEPTION 'Răspuns obligatoriu lipsă: %', _q.text;
      END IF;
    END IF;
  END LOOP;

  SELECT id INTO _eid FROM volunteer_enrollments WHERE project_id = _project_id AND student_id = _uid LIMIT 1;
  IF _eid IS NULL THEN
    INSERT INTO volunteer_enrollments (project_id, student_id, status) VALUES (_project_id, _uid, 'enrolled') RETURNING id INTO _eid;
  ELSE
    UPDATE volunteer_enrollments SET status = 'enrolled', enrolled_at = now(), withdrawn_at = NULL WHERE id = _eid;
    DELETE FROM volunteer_enrollment_answers WHERE enrollment_id = _eid;
  END IF;

  INSERT INTO volunteer_enrollment_answers (enrollment_id, question_id, value)
  SELECT _eid, q.id, _answers->(q.id::text) FROM volunteer_form_questions q
  WHERE q.project_id = _project_id AND _answers ? q.id::text;
  RETURN _eid;
END; $$;

REVOKE EXECUTE ON FUNCTION public.submit_volunteer_enrollment(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.submit_volunteer_enrollment(uuid, jsonb) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.can_manage_volunteer(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_manage_volunteer(uuid, uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.get_project_id_for_volunteer_enrollment(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_project_id_for_volunteer_enrollment(uuid) TO authenticated, service_role;