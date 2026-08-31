DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = 'public'
  LOOP
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t.tablename);
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.tablename);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.tablename);
  END LOOP;
END $$;

REVOKE ALL ON public.profiles FROM authenticated;
GRANT SELECT (id, first_name, last_name, username, display_name, student_identifier, is_active, created_at, updated_at, must_change_password, teaching_norm, initials) ON public.profiles TO authenticated;
GRANT INSERT, UPDATE (id, first_name, last_name, username, student_identifier, is_active, must_change_password, teaching_norm, initials) ON public.profiles TO authenticated;
GRANT DELETE ON public.profiles TO authenticated;

GRANT SELECT ON public.events TO anon;