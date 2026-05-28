CREATE TABLE public.feedback_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.feedback_forms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subject_teacher_id uuid,
  completed_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX feedback_completions_unique
  ON public.feedback_completions (form_id, user_id, COALESCE(subject_teacher_id, '00000000-0000-0000-0000-000000000000'::uuid));

GRANT SELECT ON public.feedback_completions TO authenticated;
GRANT ALL ON public.feedback_completions TO service_role;

ALTER TABLE public.feedback_completions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own completions" ON public.feedback_completions
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE OR REPLACE FUNCTION public.submit_feedback_response(_form_id uuid, _teacher_id uuid, _identified boolean, _answers jsonb, _response_id uuid DEFAULT NULL::uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _form record;
  _uid uuid := auth.uid();
  _check jsonb;
  _resp_id uuid;
  _is_anonymous boolean;
  _ans jsonb;
BEGIN
  IF _uid IS NULL THEN
    RAISE EXCEPTION 'Neautentificat';
  END IF;

  SELECT * INTO _form FROM public.feedback_forms WHERE id = _form_id;
  IF _form IS NULL THEN
    RAISE EXCEPTION 'Chestionarul nu a fost găsit';
  END IF;

  IF _response_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.feedback_responses
      WHERE id = _response_id AND respondent_id = _uid AND is_identified = true
    ) THEN
      RAISE EXCEPTION 'Nu poți edita acest răspuns';
    END IF;
    IF _form.status <> 'active' OR (_form.closes_at IS NOT NULL AND now() > _form.closes_at) THEN
      RAISE EXCEPTION 'Chestionarul nu mai acceptă răspunsuri';
    END IF;
    UPDATE public.feedback_responses
      SET updated_at = now()
      WHERE id = _response_id;
    DELETE FROM public.feedback_answers WHERE response_id = _response_id;
    _resp_id := _response_id;
  ELSE
    _check := public.check_feedback_submission(_uid, _form_id, _teacher_id);
    IF NOT ((_check->>'allowed')::boolean) THEN
      RAISE EXCEPTION '%', COALESCE(_check->>'reason', 'Nu poți trimite acest răspuns');
    END IF;

    _is_anonymous := (_form.anonymity = 'anonymous')
                  OR (_form.anonymity = 'anonymous_optional' AND COALESCE(_identified, false) = false);

    INSERT INTO public.feedback_responses (form_id, respondent_id, subject_teacher_id, is_identified)
    VALUES (
      _form_id,
      CASE WHEN _is_anonymous THEN NULL ELSE _uid END,
      CASE WHEN _form.type = 'teacher_feedback' THEN _teacher_id ELSE NULL END,
      NOT _is_anonymous
    )
    RETURNING id INTO _resp_id;

    -- Track completion regardless of anonymity (separate from response, no PII linkage)
    INSERT INTO public.feedback_completions (form_id, user_id, subject_teacher_id)
    VALUES (
      _form_id,
      _uid,
      CASE WHEN _form.type = 'teacher_feedback' THEN _teacher_id ELSE NULL END
    )
    ON CONFLICT DO NOTHING;
  END IF;

  IF _answers IS NOT NULL AND jsonb_typeof(_answers) = 'array' THEN
    FOR _ans IN SELECT * FROM jsonb_array_elements(_answers)
    LOOP
      IF (_ans->>'question_id') IS NOT NULL THEN
        INSERT INTO public.feedback_answers (response_id, question_id, value)
        VALUES (_resp_id, (_ans->>'question_id')::uuid, _ans->'value');
      END IF;
    END LOOP;
  END IF;

  RETURN _resp_id;
END;
$function$;

-- Also update check_feedback_submission to use completions for anti-duplicate (so anonymous can't double-submit)
CREATE OR REPLACE FUNCTION public.check_feedback_submission(_user_id uuid, _form_id uuid, _teacher_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  _form record;
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
  IF EXISTS (
    SELECT 1 FROM public.feedback_completions
    WHERE form_id = _form_id
      AND user_id = _user_id
      AND COALESCE(subject_teacher_id, '00000000-0000-0000-0000-000000000000'::uuid)
        = COALESCE(_teacher_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Ai răspuns deja la acest chestionar');
  END IF;
  RETURN jsonb_build_object('allowed', true);
END;
$function$;