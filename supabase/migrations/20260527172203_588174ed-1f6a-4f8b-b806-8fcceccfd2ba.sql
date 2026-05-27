CREATE POLICY "CSE read event participant profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'cse'::app_role)
  AND id IN (
    SELECT r.student_id FROM public.reservations r
    WHERE is_event_creator(r.event_id, auth.uid())
  )
);

CREATE POLICY "CSE read student profiles for assistant assignment"
ON public.profiles FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'cse'::app_role)
  AND id IN (SELECT user_id FROM public.user_roles WHERE role = 'student'::app_role)
);

CREATE POLICY "CSE read roles for assignment"
ON public.user_roles FOR SELECT TO authenticated
USING (has_role(auth.uid(),'cse'::app_role));

CREATE POLICY "CSE read student class assignments"
ON public.student_class_assignments FOR SELECT TO authenticated
USING (has_role(auth.uid(),'cse'::app_role));