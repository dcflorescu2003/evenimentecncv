DO $$
DECLARE t record;
BEGIN
  FOR t IN SELECT c.relname FROM pg_class c JOIN pg_namespace n ON n.oid=c.relnamespace
           WHERE n.nspname='public' AND c.relkind='r'
  LOOP
    EXECUTE format('GRANT SELECT, INSERT, UPDATE, DELETE ON public.%I TO authenticated', t.relname);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t.relname);
  END LOOP;
END $$;

-- profiles: email nu trebuie citibil direct de utilizatorii autentificați
REVOKE SELECT, INSERT, UPDATE, DELETE ON public.profiles FROM authenticated;
DO $$
DECLARE cols text;
BEGIN
  SELECT string_agg(quote_ident(column_name), ', ') INTO cols
  FROM information_schema.columns
  WHERE table_schema='public' AND table_name='profiles' AND column_name <> 'email';
  EXECUTE format('GRANT SELECT (%s) ON public.profiles TO authenticated', cols);
  EXECUTE format('GRANT INSERT (%s) ON public.profiles TO authenticated', cols);
  EXECUTE format('GRANT UPDATE (%s) ON public.profiles TO authenticated', cols);
END $$;

-- acces public (nelogat) strict unde politicile o cer
GRANT SELECT ON public.events TO anon;
GRANT INSERT ON public.public_reservations TO anon;
GRANT INSERT ON public.public_tickets TO anon;