
CREATE POLICY "Teachers read student class assignments for event participants"
ON public.student_class_assignments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND (
    student_id IN (
      SELECT r.student_id FROM reservations r
      JOIN coordinator_assignments ca ON ca.event_id = r.event_id
      WHERE ca.teacher_id = auth.uid()
    )
  )
);

CREATE POLICY "Coordinator teachers read student class assignments"
ON public.student_class_assignments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordinator_teacher'::app_role) AND (
    student_id IN (
      SELECT r.student_id FROM reservations r
      JOIN coordinator_assignments ca ON ca.event_id = r.event_id
      WHERE ca.teacher_id = auth.uid()
    )
  )
);
