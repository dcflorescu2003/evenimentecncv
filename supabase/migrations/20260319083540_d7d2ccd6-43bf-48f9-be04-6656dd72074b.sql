
CREATE POLICY "Students read events with reservations"
ON public.events
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND id IN (
    SELECT event_id FROM public.reservations WHERE student_id = auth.uid()
  )
);
