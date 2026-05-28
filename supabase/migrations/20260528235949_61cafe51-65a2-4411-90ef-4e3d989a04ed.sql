-- Allow any authenticated user to read volunteer_days for active projects (for calendar visibility)
CREATE POLICY "Authenticated read days of active projects" ON public.volunteer_days
  FOR SELECT TO authenticated
  USING (EXISTS (
    SELECT 1 FROM public.volunteer_projects vp
    WHERE vp.id = volunteer_days.project_id
      AND vp.status = 'active'
  ));