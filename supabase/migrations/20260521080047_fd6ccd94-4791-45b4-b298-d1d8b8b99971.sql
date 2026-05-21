-- Drop unused legacy student submission storage policies (wrong prefix)
DROP POLICY IF EXISTS "Students upload form submissions to storage" ON storage.objects;
DROP POLICY IF EXISTS "Students read own submissions from storage" ON storage.objects;

-- Students: upload propriile formulare completate sub <event_id>/form-submissions/<student_id>/...
CREATE POLICY "Students upload own form submissions"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-files'
    AND public.has_role(auth.uid(), 'student')
    AND (storage.foldername(name))[2] = 'form-submissions'
    AND (storage.foldername(name))[3] = auth.uid()::text
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ((storage.foldername(name))[1])::uuid
        AND e.published = true
        AND e.status = 'published'
    )
  );

-- Students: citește propriile submisii
CREATE POLICY "Students read own form submissions"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'event-files'
    AND public.has_role(auth.uid(), 'student')
    AND (storage.foldername(name))[2] = 'form-submissions'
    AND (storage.foldername(name))[3] = auth.uid()::text
  );

-- Students: citește formularele-template ale evenimentelor publicate
CREATE POLICY "Students read form template files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'event-files'
    AND public.has_role(auth.uid(), 'student')
    AND (storage.foldername(name))[2] = 'form_template'
    AND EXISTS (
      SELECT 1 FROM public.events e
      WHERE e.id = ((storage.foldername(name))[1])::uuid
        AND e.published = true
        AND e.status = 'published'
    )
  );