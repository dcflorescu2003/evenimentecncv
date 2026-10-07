CREATE OR REPLACE FUNCTION public.get_coordinator_conflicts(_teacher_id uuid, _date date, _start time, _end time, _exclude_event_id uuid DEFAULT NULL)
RETURNS TABLE(event_id uuid, title text, date date, start_time time, end_time time)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT e.id, e.title, e.date, e.start_time, e.end_time
  FROM public.events e
  WHERE auth.uid() IS NOT NULL
    AND e.date = _date
    AND e.start_time < _end AND e.end_time > _start
    AND e.status NOT IN ('draft','cancelled')
    AND (_exclude_event_id IS NULL OR e.id <> _exclude_event_id)
    AND (e.created_by = _teacher_id OR EXISTS (
      SELECT 1 FROM public.coordinator_assignments ca WHERE ca.event_id = e.id AND ca.teacher_id = _teacher_id))
  ORDER BY e.start_time;
$$;
REVOKE ALL ON FUNCTION public.get_coordinator_conflicts(uuid,date,time,time,uuid) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.get_coordinator_conflicts(uuid,date,time,time,uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.leave_event_coordination(_event_id uuid, _reason text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _uid uuid := auth.uid(); _ev record; _name text; _body text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Neautentificat'; END IF;
  SELECT id, title, created_by INTO _ev FROM public.events WHERE id = _event_id;
  IF _ev.id IS NULL THEN RAISE EXCEPTION 'Evenimentul nu există'; END IF;
  IF _ev.created_by = _uid THEN RAISE EXCEPTION 'Organizatorul nu poate renunța la propriul eveniment'; END IF;
  DELETE FROM public.coordinator_assignments WHERE event_id = _event_id AND teacher_id = _uid;
  IF NOT FOUND THEN RAISE EXCEPTION 'Nu ești coordonator la acest eveniment'; END IF;
  SELECT trim(coalesce(last_name,'') || ' ' || coalesce(first_name,'')) INTO _name FROM public.profiles WHERE id = _uid;
  _body := coalesce(_name,'Un coordonator') || ' a renunțat la coordonarea evenimentului „' || _ev.title || '".'
    || CASE WHEN nullif(trim(coalesce(_reason,'')),'') IS NOT NULL THEN ' Motiv: ' || left(trim(_reason), 500) ELSE '' END;
  IF _ev.created_by IS NOT NULL THEN
    INSERT INTO public.notifications(user_id, title, body, type, related_event_id)
    VALUES (_ev.created_by, 'Coordonator retras', _body, 'coordinator_left', _event_id);
  END IF;
  INSERT INTO public.audit_logs(user_id, action, entity_type, entity_id, details)
  VALUES (_uid, 'coordinator_left', 'event', _event_id, jsonb_build_object('reason', left(coalesce(_reason,''),500)));
  RETURN _ev.created_by;
END $$;
REVOKE ALL ON FUNCTION public.leave_event_coordination(uuid,text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.leave_event_coordination(uuid,text) TO authenticated, service_role;