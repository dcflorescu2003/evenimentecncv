DROP POLICY IF EXISTS "Students enroll self" ON public.club_enrollments;
CREATE POLICY "Students request enrollment" ON public.club_enrollments
  FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND public.has_role(auth.uid(), 'student') AND status = 'pending');