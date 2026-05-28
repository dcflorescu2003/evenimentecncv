
DROP POLICY IF EXISTS "Teachers/CSE/Homeroom create forms" ON public.feedback_forms;

CREATE POLICY "Teachers/CSE/Homeroom create forms" ON public.feedback_forms
  FOR INSERT TO authenticated
  WITH CHECK (
    created_by = auth.uid()
    AND (
      public.has_role(auth.uid(), 'teacher'::app_role)
      OR public.has_role(auth.uid(), 'homeroom_teacher'::app_role)
      OR public.has_role(auth.uid(), 'cse'::app_role)
    )
    AND type = 'general'
  );
