
CREATE POLICY "Portfolio owners read own files"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'portfolio-files'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        public.has_module_access(auth.uid(), 'portfolio')
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  );

CREATE POLICY "Portfolio owners upload own files"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'portfolio-files'
    AND public.has_module_access(auth.uid(), 'portfolio')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Portfolio owners update own files"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'portfolio-files'
    AND public.has_module_access(auth.uid(), 'portfolio')
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Portfolio owners delete own files"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'portfolio-files'
    AND (
      public.has_role(auth.uid(), 'admin')
      OR (
        public.has_module_access(auth.uid(), 'portfolio')
        AND (storage.foldername(name))[1] = auth.uid()::text
      )
    )
  );
