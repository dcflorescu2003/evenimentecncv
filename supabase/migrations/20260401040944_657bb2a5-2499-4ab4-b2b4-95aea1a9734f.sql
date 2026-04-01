CREATE POLICY "Homeroom teachers read events with class student reservations"
ON public.events
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'homeroom_teacher'::app_role)
  AND id IN (
    SELECT r.event_id FROM public.reservations r
    JOIN public.student_class_assignments sca ON sca.student_id = r.student_id
    JOIN public.classes c ON c.id = sca.class_id
    WHERE c.homeroom_teacher_id = auth.uid()
  )
);