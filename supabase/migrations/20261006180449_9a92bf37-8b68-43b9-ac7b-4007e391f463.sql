CREATE OR REPLACE FUNCTION public.prevent_direct_username_change()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.username IS DISTINCT FROM OLD.username
     AND coalesce(current_setting('request.jwt.claim.role', true), '') <> 'service_role'
     AND current_user NOT IN ('service_role','postgres','supabase_admin') THEN
    RAISE EXCEPTION 'Numele de utilizator se poate schimba doar din pagina de administrare a utilizatorilor';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_prevent_direct_username_change ON public.profiles;
CREATE TRIGGER trg_prevent_direct_username_change BEFORE UPDATE OF username ON public.profiles
FOR EACH ROW EXECUTE FUNCTION public.prevent_direct_username_change();