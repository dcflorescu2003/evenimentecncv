CREATE POLICY "Homeroom teachers read class student assistants"
ON public.event_student_assistants
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'homeroom_teacher'::app_role)
  AND student_id IN (
    SELECT sca.student_id
    FROM student_class_assignments sca
    JOIN classes c ON c.id = sca.class_id
    WHERE c.homeroom_teacher_id = auth.uid()
  )
);