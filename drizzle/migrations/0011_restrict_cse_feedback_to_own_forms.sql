CREATE OR REPLACE FUNCTION public.cse_can_read_feedback(_form_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT NOT public.has_role(auth.uid(), 'cse')
    OR public.has_role(auth.uid(), 'admin')
    OR public.is_feedback_creator(_form_id, auth.uid());
$$;
REVOKE ALL ON FUNCTION public.cse_can_read_feedback(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cse_can_read_feedback(uuid) TO authenticated, service_role;
CREATE POLICY "CSE reads only own feedback forms" ON public.feedback_forms AS RESTRICTIVE FOR SELECT TO authenticated USING (public.cse_can_read_feedback(id));
CREATE POLICY "CSE reads only own feedback questions" ON public.feedback_questions AS RESTRICTIVE FOR SELECT TO authenticated USING (public.cse_can_read_feedback(form_id));
CREATE POLICY "CSE reads only own feedback responses" ON public.feedback_responses AS RESTRICTIVE FOR SELECT TO authenticated USING (public.cse_can_read_feedback(form_id));
CREATE POLICY "CSE reads only own feedback answers" ON public.feedback_answers AS RESTRICTIVE FOR SELECT TO authenticated USING (public.cse_can_read_feedback(public.get_form_id_for_response(response_id)));
CREATE POLICY "CSE reads only own feedback completions" ON public.feedback_completions AS RESTRICTIVE FOR SELECT TO authenticated USING (public.cse_can_read_feedback(form_id));