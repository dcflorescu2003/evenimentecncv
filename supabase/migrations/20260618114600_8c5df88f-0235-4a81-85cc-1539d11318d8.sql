-- Storage policies for event-files bucket: add SELECT for managers/coordinators, DELETE for students (own submissions) and coordinators

DROP POLICY IF EXISTS "Managers read event files storage" ON storage.objects;
CREATE POLICY "Managers read event files storage"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'event-files'
  AND public.has_role(auth.uid(), 'manager'::public.app_role)
);

DROP POLICY IF EXISTS "Coordinators read event files storage" ON storage.objects;
CREATE POLICY "Coordinators read event files storage"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'event-files'
  AND public.is_coordinator_for_event(((storage.foldername(name))[1])::uuid, auth.uid())
);

DROP POLICY IF EXISTS "Students delete own form submissions storage" ON storage.objects;
CREATE POLICY "Students delete own form submissions storage"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-files'
  AND public.has_role(auth.uid(), 'student'::public.app_role)
  AND (storage.foldername(name))[2] = 'form-submissions'
  AND (storage.foldername(name))[3] = auth.uid()::text
);

DROP POLICY IF EXISTS "Coordinators delete event files storage" ON storage.objects;
CREATE POLICY "Coordinators delete event files storage"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'event-files'
  AND public.is_coordinator_for_event(((storage.foldername(name))[1])::uuid, auth.uid())
);