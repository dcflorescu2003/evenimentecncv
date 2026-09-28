ALTER TABLE public.events ADD COLUMN room_id uuid REFERENCES public.vr_rooms(id) ON DELETE SET NULL;
CREATE INDEX idx_events_room_date ON public.events(room_id, date) WHERE room_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.validate_event_room()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE c record; rname text;
BEGIN
  IF NEW.room_id IS NULL THEN RETURN NEW; END IF;
  SELECT name INTO rname FROM vr_rooms WHERE id = NEW.room_id;
  NEW.location := rname;
  IF NEW.status IN ('draft','cancelled') THEN RETURN NEW; END IF;
  PERFORM pg_advisory_xact_lock(hashtext(NEW.room_id::text || NEW.date::text));
  SELECT title, start_time, end_time INTO c FROM events
   WHERE room_id = NEW.room_id AND date = NEW.date AND id <> NEW.id
     AND status NOT IN ('draft','cancelled')
     AND start_time < NEW.end_time AND NEW.start_time < end_time
   LIMIT 1;
  IF FOUND THEN
    RAISE EXCEPTION 'Sala % este ocupată între % și % de evenimentul „%".',
      rname, to_char(c.start_time,'HH24:MI'), to_char(c.end_time,'HH24:MI'), c.title;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER trg_validate_event_room BEFORE INSERT OR UPDATE ON public.events
FOR EACH ROW EXECUTE FUNCTION public.validate_event_room();

CREATE OR REPLACE FUNCTION public.get_available_rooms(_date date, _start time, _end time, _exclude_event_id uuid DEFAULT NULL)
RETURNS TABLE(id uuid, name text) LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT r.id, r.name FROM vr_rooms r
  WHERE r.is_active AND NOT EXISTS (
    SELECT 1 FROM events e WHERE e.room_id = r.id AND e.date = _date
      AND e.status NOT IN ('draft','cancelled')
      AND (_exclude_event_id IS NULL OR e.id <> _exclude_event_id)
      AND e.start_time < _end AND _start < e.end_time)
  ORDER BY r.sort_order, r.name
$$;
REVOKE EXECUTE ON FUNCTION public.get_available_rooms(date,time,time,uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_available_rooms(date,time,time,uuid) TO authenticated, service_role;
REVOKE EXECUTE ON FUNCTION public.validate_event_room() FROM PUBLIC, anon, authenticated;