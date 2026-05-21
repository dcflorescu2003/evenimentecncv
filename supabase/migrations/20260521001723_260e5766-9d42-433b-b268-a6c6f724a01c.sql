
-- Storage policies for event-files bucket: allow cse, teacher, homeroom_teacher
-- to manage files for events they created. Path convention: <event_id>/<category>/<filename>

CREATE POLICY "Event creators manage event files storage"
  ON storage.objects FOR ALL
  TO authenticated
  USING (
    bucket_id = 'event-files'
    AND (
      public.has_role(auth.uid(), 'cse')
      OR public.has_role(auth.uid(), 'teacher')
      OR public.has_role(auth.uid(), 'homeroom_teacher')
    )
    AND public.is_event_creator(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  )
  WITH CHECK (
    bucket_id = 'event-files'
    AND (
      public.has_role(auth.uid(), 'cse')
      OR public.has_role(auth.uid(), 'teacher')
      OR public.has_role(auth.uid(), 'homeroom_teacher')
    )
    AND public.is_event_creator(
      ((storage.foldername(name))[1])::uuid,
      auth.uid()
    )
  );
