CREATE OR REPLACE FUNCTION public.apply_session_event_rules()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _s record; _cls uuid[];
BEGIN
  IF NEW.session_id IS NULL THEN RETURN NEW; END IF;
  SELECT booking_open_at, booking_close_at, force_teacher_classes INTO _s FROM program_sessions WHERE id = NEW.session_id;
  IF NOT FOUND THEN RETURN NEW; END IF;
  IF _s.booking_open_at IS NOT NULL THEN NEW.booking_open_at := _s.booking_open_at; END IF;
  IF _s.booking_close_at IS NOT NULL THEN NEW.booking_close_at := _s.booking_close_at; END IF;
  IF _s.force_teacher_classes AND NEW.created_by IS NOT NULL
     AND NOT coalesce(NEW.is_cse, false) AND NOT coalesce(NEW.is_public, false)
     AND NOT has_role(NEW.created_by, 'admin') THEN
    SELECT array_agg(DISTINCT class_id) INTO _cls FROM portfolio_teacher_classes WHERE teacher_id = NEW.created_by;
    IF _cls IS NOT NULL THEN
      NEW.eligible_classes := ARRAY(SELECT DISTINCT x FROM unnest(coalesce(NEW.eligible_classes, '{}'::uuid[]) || _cls) x);
    END IF;
  END IF;
  RETURN NEW;
END $$;