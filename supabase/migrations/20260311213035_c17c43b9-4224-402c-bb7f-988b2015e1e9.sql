CREATE POLICY "Students insert own tickets"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (
  reservation_id IN (
    SELECT id FROM reservations WHERE student_id = auth.uid()
  )
);

CREATE POLICY "Students update own tickets"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  reservation_id IN (
    SELECT id FROM reservations WHERE student_id = auth.uid()
  )
);