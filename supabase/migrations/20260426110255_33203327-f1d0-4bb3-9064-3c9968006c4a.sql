-- Extindere enum cu status reviewed
ALTER TYPE public.form_submission_status ADD VALUE IF NOT EXISTS 'reviewed';

-- RLS pentru CSE
CREATE POLICY "CSE read event submissions" ON public.form_submissions
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'cse'::app_role) AND is_event_creator(event_id, auth.uid()));

CREATE POLICY "CSE update event submissions" ON public.form_submissions
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cse'::app_role) AND is_event_creator(event_id, auth.uid()))
WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND is_event_creator(event_id, auth.uid()));

-- RLS pentru Profesori (creatori eveniment)
CREATE POLICY "Teachers read event submissions" ON public.form_submissions
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND is_event_creator(event_id, auth.uid()));

CREATE POLICY "Teachers update event submissions" ON public.form_submissions
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND is_event_creator(event_id, auth.uid()))
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND is_event_creator(event_id, auth.uid()));

-- RLS pentru Diriginți (creatori eveniment)
CREATE POLICY "Homeroom teachers read event submissions" ON public.form_submissions
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND is_event_creator(event_id, auth.uid()));

CREATE POLICY "Homeroom teachers update event submissions" ON public.form_submissions
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND is_event_creator(event_id, auth.uid()))
WITH CHECK (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND is_event_creator(event_id, auth.uid()));