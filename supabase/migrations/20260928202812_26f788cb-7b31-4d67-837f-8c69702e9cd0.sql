CREATE OR REPLACE FUNCTION public.validate_event_in_session()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE s record;
BEGIN
  IF NEW.session_id IS NULL OR NEW.date IS NULL THEN RETURN NEW; END IF;
  SELECT start_date, end_date INTO s FROM program_sessions WHERE id = NEW.session_id;
  IF s.start_date IS NOT NULL AND s.end_date IS NOT NULL AND (NEW.date < s.start_date OR NEW.date > s.end_date) THEN
    RAISE EXCEPTION 'Data evenimentului trebuie să fie între % și % (perioada sesiunii).',
      to_char(s.start_date,'DD.MM.YYYY'), to_char(s.end_date,'DD.MM.YYYY');
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_event_in_session
BEFORE INSERT OR UPDATE OF date, session_id ON public.events
FOR EACH ROW EXECUTE FUNCTION public.validate_event_in_session();