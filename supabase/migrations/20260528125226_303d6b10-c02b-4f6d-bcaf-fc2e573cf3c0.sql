
-- Enums
CREATE TYPE public.feedback_type AS ENUM ('general', 'teacher_feedback', 'teacher_survey');
CREATE TYPE public.feedback_anonymity AS ENUM ('anonymous', 'identified', 'anonymous_optional');
CREATE TYPE public.feedback_audience AS ENUM ('students', 'teachers');
CREATE TYPE public.feedback_form_status AS ENUM ('draft', 'active', 'closed');
CREATE TYPE public.feedback_question_type AS ENUM ('single_choice', 'multi_choice', 'dropdown', 'scale', 'open_text');

-- =========================
-- feedback_forms
-- =========================
CREATE TABLE public.feedback_forms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  title text NOT NULL,
  description text,
  type public.feedback_type NOT NULL DEFAULT 'general',
  anonymity public.feedback_anonymity NOT NULL DEFAULT 'anonymous',
  audience public.feedback_audience NOT NULL DEFAULT 'students',
  status public.feedback_form_status NOT NULL DEFAULT 'draft',
  session_id uuid,
  opens_at timestamptz,
  closes_at timestamptz,
  eligible_grades int[],
  eligible_classes uuid[],
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_forms TO authenticated;
GRANT ALL ON public.feedback_forms TO service_role;

ALTER TABLE public.feedback_forms ENABLE ROW LEVEL SECURITY;

-- =========================
-- feedback_questions
-- =========================
CREATE TABLE public.feedback_questions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.feedback_forms(id) ON DELETE CASCADE,
  position int NOT NULL DEFAULT 0,
  question_type public.feedback_question_type NOT NULL,
  text text NOT NULL,
  required boolean NOT NULL DEFAULT false,
  options jsonb,
  scale_min int,
  scale_max int,
  scale_min_label text,
  scale_max_label text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_questions_form ON public.feedback_questions(form_id, position);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_questions TO authenticated;
GRANT ALL ON public.feedback_questions TO service_role;

ALTER TABLE public.feedback_questions ENABLE ROW LEVEL SECURITY;

-- =========================
-- feedback_responses
-- =========================
CREATE TABLE public.feedback_responses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.feedback_forms(id) ON DELETE CASCADE,
  respondent_id uuid,
  subject_teacher_id uuid,
  class_id uuid,
  is_identified boolean NOT NULL DEFAULT false,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_responses_form ON public.feedback_responses(form_id);
CREATE INDEX idx_feedback_responses_respondent ON public.feedback_responses(respondent_id) WHERE respondent_id IS NOT NULL;
CREATE INDEX idx_feedback_responses_subject ON public.feedback_responses(subject_teacher_id) WHERE subject_teacher_id IS NOT NULL;
CREATE UNIQUE INDEX uq_feedback_response_per_user
  ON public.feedback_responses(form_id, respondent_id, COALESCE(subject_teacher_id, '00000000-0000-0000-0000-000000000000'::uuid))
  WHERE respondent_id IS NOT NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_responses TO authenticated;
GRANT ALL ON public.feedback_responses TO service_role;

ALTER TABLE public.feedback_responses ENABLE ROW LEVEL SECURITY;

-- =========================
-- feedback_answers
-- =========================
CREATE TABLE public.feedback_answers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  response_id uuid NOT NULL REFERENCES public.feedback_responses(id) ON DELETE CASCADE,
  question_id uuid NOT NULL REFERENCES public.feedback_questions(id) ON DELETE CASCADE,
  value jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_feedback_answers_response ON public.feedback_answers(response_id);
CREATE INDEX idx_feedback_answers_question ON public.feedback_answers(question_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.feedback_answers TO authenticated;
GRANT ALL ON public.feedback_answers TO service_role;

ALTER TABLE public.feedback_answers ENABLE ROW LEVEL SECURITY;

-- =========================
-- Security definer helpers
-- =========================
CREATE OR REPLACE FUNCTION public.is_feedback_creator(_form_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.feedback_forms WHERE id = _form_id AND created_by = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.get_form_id_for_response(_response_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT form_id FROM public.feedback_responses WHERE id = _response_id
$$;

CREATE OR REPLACE FUNCTION public.get_form_id_for_question(_question_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT form_id FROM public.feedback_questions WHERE id = _question_id
$$;

CREATE OR REPLACE FUNCTION public.get_response_meta(_response_id uuid)
RETURNS TABLE(form_id uuid, respondent_id uuid, subject_teacher_id uuid)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT form_id, respondent_id, subject_teacher_id FROM public.feedback_responses WHERE id = _response_id
$$;

CREATE OR REPLACE FUNCTION public.is_feedback_subject_teacher(_user_id uuid, _response_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.feedback_responses
    WHERE id = _response_id AND subject_teacher_id = _user_id
  )
$$;

-- Eligibility check for student to fill a form
CREATE OR REPLACE FUNCTION public.is_student_eligible_for_form(_user_id uuid, _form_id uuid)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _form record;
  _class_id uuid;
  _grade int;
BEGIN
  SELECT * INTO _form FROM public.feedback_forms WHERE id = _form_id;
  IF _form IS NULL OR _form.audience <> 'students' THEN RETURN false; END IF;
  SELECT class_id INTO _class_id FROM public.student_class_assignments
    WHERE student_id = _user_id ORDER BY created_at DESC LIMIT 1;
  IF _form.eligible_classes IS NOT NULL AND array_length(_form.eligible_classes, 1) > 0 THEN
    IF _class_id IS NULL OR NOT (_class_id = ANY(_form.eligible_classes)) THEN RETURN false; END IF;
  ELSIF _form.eligible_grades IS NOT NULL AND array_length(_form.eligible_grades, 1) > 0 THEN
    SELECT grade_number INTO _grade FROM public.classes WHERE id = _class_id;
    IF _grade IS NULL OR NOT (_grade = ANY(_form.eligible_grades)) THEN RETURN false; END IF;
  END IF;
  RETURN true;
END;
$$;

-- Eligibility check RPC for submission
CREATE OR REPLACE FUNCTION public.check_feedback_submission(_user_id uuid, _form_id uuid, _teacher_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _form record;
  _eligible boolean;
BEGIN
  SELECT * INTO _form FROM public.feedback_forms WHERE id = _form_id;
  IF _form IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Chestionarul nu a fost găsit');
  END IF;
  IF _form.status <> 'active' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Chestionarul nu este activ');
  END IF;
  IF _form.opens_at IS NOT NULL AND now() < _form.opens_at THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Chestionarul nu este încă deschis');
  END IF;
  IF _form.closes_at IS NOT NULL AND now() > _form.closes_at THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Chestionarul s-a închis');
  END IF;
  IF _form.audience = 'students' THEN
    IF NOT public.is_student_eligible_for_form(_user_id, _form_id) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Nu ești eligibil pentru acest chestionar');
    END IF;
  ELSE
    IF NOT (public.has_role(_user_id, 'teacher'::app_role)
         OR public.has_role(_user_id, 'homeroom_teacher'::app_role)
         OR public.has_role(_user_id, 'coordinator_teacher'::app_role)
         OR public.has_role(_user_id, 'cse'::app_role)) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Doar profesorii pot răspunde la acest chestionar');
    END IF;
  END IF;
  IF _form.type = 'teacher_feedback' AND _teacher_id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Selectează un profesor');
  END IF;
  -- anti-duplicate (only when respondent_id will be saved)
  IF EXISTS (
    SELECT 1 FROM public.feedback_responses
    WHERE form_id = _form_id
      AND respondent_id = _user_id
      AND COALESCE(subject_teacher_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(_teacher_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Ai răspuns deja la acest chestionar');
  END IF;
  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- =========================
-- RLS Policies: feedback_forms
-- =========================
CREATE POLICY "Admins manage feedback forms" ON public.feedback_forms
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creators read own forms" ON public.feedback_forms
  FOR SELECT TO authenticated USING (created_by = auth.uid());

CREATE POLICY "Creators update own forms" ON public.feedback_forms
  FOR UPDATE TO authenticated USING (created_by = auth.uid()) WITH CHECK (created_by = auth.uid());

CREATE POLICY "Creators delete own forms" ON public.feedback_forms
  FOR DELETE TO authenticated USING (created_by = auth.uid());

CREATE POLICY "Teachers/CSE/Homeroom create forms" ON public.feedback_forms
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'teacher'::app_role)
      OR public.has_role(auth.uid(), 'homeroom_teacher'::app_role)
      OR public.has_role(auth.uid(), 'cse'::app_role)
    )
    AND type <> 'teacher_survey'
  );

CREATE POLICY "Eligible students read active forms" ON public.feedback_forms
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND audience = 'students'
    AND public.has_role(auth.uid(), 'student'::app_role)
    AND public.is_student_eligible_for_form(auth.uid(), id)
  );

CREATE POLICY "Teachers read active teacher surveys" ON public.feedback_forms
  FOR SELECT TO authenticated
  USING (
    status = 'active'
    AND audience = 'teachers'
    AND (
      public.has_role(auth.uid(), 'teacher'::app_role)
      OR public.has_role(auth.uid(), 'homeroom_teacher'::app_role)
      OR public.has_role(auth.uid(), 'coordinator_teacher'::app_role)
      OR public.has_role(auth.uid(), 'cse'::app_role)
    )
  );

-- =========================
-- RLS Policies: feedback_questions
-- =========================
CREATE POLICY "Admins manage questions" ON public.feedback_questions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creators manage questions" ON public.feedback_questions
  FOR ALL TO authenticated
  USING (public.is_feedback_creator(form_id, auth.uid()))
  WITH CHECK (public.is_feedback_creator(form_id, auth.uid()));

CREATE POLICY "Authenticated read questions of readable forms" ON public.feedback_questions
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.feedback_forms f
      WHERE f.id = form_id
        AND f.status = 'active'
        AND (
          (f.audience = 'students' AND public.has_role(auth.uid(), 'student'::app_role) AND public.is_student_eligible_for_form(auth.uid(), f.id))
          OR (f.audience = 'teachers' AND (
                public.has_role(auth.uid(), 'teacher'::app_role)
             OR public.has_role(auth.uid(), 'homeroom_teacher'::app_role)
             OR public.has_role(auth.uid(), 'coordinator_teacher'::app_role)
             OR public.has_role(auth.uid(), 'cse'::app_role)))
        )
    )
  );

-- =========================
-- RLS Policies: feedback_responses
-- =========================
CREATE POLICY "Admins manage responses" ON public.feedback_responses
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creators read responses" ON public.feedback_responses
  FOR SELECT TO authenticated USING (public.is_feedback_creator(form_id, auth.uid()));

CREATE POLICY "Subject teacher reads own feedback responses" ON public.feedback_responses
  FOR SELECT TO authenticated USING (subject_teacher_id = auth.uid());

CREATE POLICY "Respondent reads own responses" ON public.feedback_responses
  FOR SELECT TO authenticated USING (respondent_id = auth.uid());

CREATE POLICY "Respondent inserts own response" ON public.feedback_responses
  FOR INSERT TO authenticated
  WITH CHECK (
    respondent_id = auth.uid()
    AND (public.check_feedback_submission(auth.uid(), form_id, subject_teacher_id) ->> 'allowed')::boolean = true
  );

CREATE POLICY "Respondent updates own non-anonymous response" ON public.feedback_responses
  FOR UPDATE TO authenticated
  USING (respondent_id = auth.uid())
  WITH CHECK (respondent_id = auth.uid());

-- =========================
-- RLS Policies: feedback_answers
-- =========================
CREATE POLICY "Admins manage answers" ON public.feedback_answers
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Creators read answers" ON public.feedback_answers
  FOR SELECT TO authenticated
  USING (public.is_feedback_creator(public.get_form_id_for_response(response_id), auth.uid()));

CREATE POLICY "Subject teacher reads answers" ON public.feedback_answers
  FOR SELECT TO authenticated
  USING (public.is_feedback_subject_teacher(auth.uid(), response_id));

CREATE POLICY "Respondent reads own answers" ON public.feedback_answers
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feedback_responses r WHERE r.id = response_id AND r.respondent_id = auth.uid()));

CREATE POLICY "Respondent inserts own answers" ON public.feedback_answers
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (SELECT 1 FROM public.feedback_responses r WHERE r.id = response_id AND r.respondent_id = auth.uid()));

CREATE POLICY "Respondent updates own answers" ON public.feedback_answers
  FOR UPDATE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feedback_responses r WHERE r.id = response_id AND r.respondent_id = auth.uid()))
  WITH CHECK (EXISTS (SELECT 1 FROM public.feedback_responses r WHERE r.id = response_id AND r.respondent_id = auth.uid()));

CREATE POLICY "Respondent deletes own answers" ON public.feedback_answers
  FOR DELETE TO authenticated
  USING (EXISTS (SELECT 1 FROM public.feedback_responses r WHERE r.id = response_id AND r.respondent_id = auth.uid()));

-- =========================
-- Triggers for updated_at
-- =========================
CREATE TRIGGER trg_feedback_forms_updated_at BEFORE UPDATE ON public.feedback_forms
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_feedback_questions_updated_at BEFORE UPDATE ON public.feedback_questions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_feedback_responses_updated_at BEFORE UPDATE ON public.feedback_responses
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
