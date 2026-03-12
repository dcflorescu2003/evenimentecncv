
-- Homeroom teachers can read reservations of their class students
CREATE POLICY "Homeroom teachers read student reservations" ON public.reservations
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'homeroom_teacher'::app_role) AND
  student_id IN (
    SELECT sca.student_id FROM student_class_assignments sca
    JOIN classes c ON c.id = sca.class_id
    WHERE c.homeroom_teacher_id = auth.uid()
  )
);

-- Homeroom teachers can read tickets of their class students
CREATE POLICY "Homeroom teachers read student tickets" ON public.tickets
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'homeroom_teacher'::app_role) AND
  reservation_id IN (
    SELECT r.id FROM reservations r
    JOIN student_class_assignments sca ON sca.student_id = r.student_id
    JOIN classes c ON c.id = sca.class_id
    WHERE c.homeroom_teacher_id = auth.uid()
  )
);

-- Homeroom teachers can read events (for displaying event details in reports)
-- Already covered by "Authenticated read published events" for published ones
-- But they may need to see event info for all events their students are enrolled in
