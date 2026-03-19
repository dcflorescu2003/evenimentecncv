CREATE POLICY "Students read events as assistants"
ON public.events
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND id IN (
    SELECT event_id FROM public.event_student_assistants
    WHERE student_id = auth.uid()
  )
);