-- Allow coordinators to read profiles of students who have reservations for their assigned events
CREATE POLICY "Coordinators read event participant profiles"
ON public.profiles
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordinator_teacher'::app_role)
  AND id IN (
    SELECT r.student_id
    FROM reservations r
    JOIN coordinator_assignments ca ON ca.event_id = r.event_id
    WHERE ca.teacher_id = auth.uid()
  )
);