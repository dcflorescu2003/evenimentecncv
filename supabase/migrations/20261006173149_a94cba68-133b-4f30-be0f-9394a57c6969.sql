CREATE OR REPLACE FUNCTION public.events_public_and_booking_defaults()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid();
BEGIN
  IF _uid IS NOT NULL AND NOT (public.has_role(_uid,'admin') OR public.has_role(_uid,'cse')) THEN
    IF TG_OP = 'INSERT' AND COALESCE(NEW.is_public,false) THEN
      RAISE EXCEPTION 'Doar adminii și CSE pot crea evenimente publice';
    ELSIF TG_OP = 'UPDATE' AND NEW.is_public IS DISTINCT FROM OLD.is_public THEN
      RAISE EXCEPTION 'Doar adminii și CSE pot schimba vizibilitatea publică a evenimentului';
    END IF;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF NEW.booking_open_at IS NULL THEN NEW.booking_open_at := now(); END IF;
    IF NEW.booking_close_at IS NULL AND NEW.date IS NOT NULL AND NEW.end_time IS NOT NULL THEN
      NEW.booking_close_at := ((NEW.date + NEW.end_time) AT TIME ZONE 'Europe/Bucharest');
    END IF;
  END IF;
  RETURN NEW;
END $$;
REVOKE EXECUTE ON FUNCTION public.events_public_and_booking_defaults() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS events_public_and_booking_defaults ON public.events;
CREATE TRIGGER events_public_and_booking_defaults BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.events_public_and_booking_defaults();