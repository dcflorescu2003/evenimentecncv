-- Allow homeroom teachers to create reservations for students in their own class
CREATE POLICY "Homeroom teachers create reservations for class students"
ON public.reservations
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'homeroom_teacher'::app_role)
  AND student_id IN (
    SELECT sca.student_id
    FROM public.student_class_assignments sca
    JOIN public.classes c ON c.id = sca.class_id
    WHERE c.homeroom_teacher_id = auth.uid()
  )
);

-- Allow homeroom teachers to update reservations for students in their own class (reactivation cancelled -> reserved)
CREATE POLICY "Homeroom teachers update reservations for class students"
ON public.reservations
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'homeroom_teacher'::app_role)
  AND student_id IN (
    SELECT sca.student_id
    FROM public.student_class_assignments sca
    JOIN public.classes c ON c.id = sca.class_id
    WHERE c.homeroom_teacher_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'homeroom_teacher'::app_role)
  AND student_id IN (
    SELECT sca.student_id
    FROM public.student_class_assignments sca
    JOIN public.classes c ON c.id = sca.class_id
    WHERE c.homeroom_teacher_id = auth.uid()
  )
);

-- Allow homeroom teachers to insert tickets for reservations of their class students
CREATE POLICY "Homeroom teachers insert tickets for class students"
ON public.tickets
FOR INSERT
TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'homeroom_teacher'::app_role)
  AND reservation_id IN (
    SELECT r.id
    FROM public.reservations r
    JOIN public.student_class_assignments sca ON sca.student_id = r.student_id
    JOIN public.classes c ON c.id = sca.class_id
    WHERE c.homeroom_teacher_id = auth.uid()
  )
);

-- Allow homeroom teachers to update tickets for reservations of their class students (regenerate QR at reactivation)
CREATE POLICY "Homeroom teachers update tickets for class students"
ON public.tickets
FOR UPDATE
TO authenticated
USING (
  has_role(auth.uid(), 'homeroom_teacher'::app_role)
  AND reservation_id IN (
    SELECT r.id
    FROM public.reservations r
    JOIN public.student_class_assignments sca ON sca.student_id = r.student_id
    JOIN public.classes c ON c.id = sca.class_id
    WHERE c.homeroom_teacher_id = auth.uid()
  )
)
WITH CHECK (
  has_role(auth.uid(), 'homeroom_teacher'::app_role)
  AND reservation_id IN (
    SELECT r.id
    FROM public.reservations r
    JOIN public.student_class_assignments sca ON sca.student_id = r.student_id
    JOIN public.classes c ON c.id = sca.class_id
    WHERE c.homeroom_teacher_id = auth.uid()
  )
);