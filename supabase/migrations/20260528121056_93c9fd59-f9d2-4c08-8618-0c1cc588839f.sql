-- Allow homeroom teachers to read volunteer projects and days for their class students
CREATE POLICY "Homeroom read volunteer projects for class students"
ON public.volunteer_projects
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'homeroom_teacher'::app_role)
  AND id IN (
    SELECT ve.project_id
    FROM volunteer_enrollments ve
    JOIN student_class_assignments sca ON sca.student_id = ve.student_id
    JOIN classes c ON c.id = sca.class_id
    WHERE c.homeroom_teacher_id = auth.uid()
  )
);

CREATE POLICY "Homeroom read volunteer days for class students"
ON public.volunteer_days
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'homeroom_teacher'::app_role)
  AND project_id IN (
    SELECT ve.project_id
    FROM volunteer_enrollments ve
    JOIN student_class_assignments sca ON sca.student_id = ve.student_id
    JOIN classes c ON c.id = sca.class_id
    WHERE c.homeroom_teacher_id = auth.uid()
  )
);