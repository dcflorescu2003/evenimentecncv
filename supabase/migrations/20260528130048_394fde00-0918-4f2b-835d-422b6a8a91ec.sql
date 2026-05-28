
CREATE OR REPLACE FUNCTION public.submit_feedback_response(
  _form_id uuid,
  _teacher_id uuid,
  _identified boolean,
  _answers jsonb,
  _response_id uuid DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
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

  -- Editing path
  IF _response_id IS NOT NULL THEN
    -- Only owner of an identified response can edit, while form still open
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
    -- New submission path
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
  END IF;

  -- Insert answers
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
$$;

GRANT EXECUTE ON FUNCTION public.submit_feedback_response(uuid, uuid, boolean, jsonb, uuid) TO authenticated;
