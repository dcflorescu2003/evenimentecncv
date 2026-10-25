ALTER TABLE public.events ADD COLUMN IF NOT EXISTS coordinator_added_classes uuid[] NOT NULL DEFAULT '{}';

CREATE OR REPLACE FUNCTION public.sync_event_coordinator_classes(_event_id uuid)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE e record; _flag boolean; _manual uuid[]; _new uuid[];
BEGIN
  SELECT id, session_id, created_by, is_public, is_cse, eligible_classes, coordinator_added_classes
    INTO e FROM events WHERE id = _event_id;
  IF NOT FOUND OR e.session_id IS NULL THEN RETURN; END IF;
  SELECT force_teacher_classes INTO _flag FROM program_sessions WHERE id = e.session_id;
  IF NOT coalesce(_flag,false) OR coalesce(e.is_public,false) OR coalesce(e.is_cse,false)
     OR (e.created_by IS NOT NULL AND has_role(e.created_by,'admin')) THEN RETURN; END IF;
  _manual := ARRAY(SELECT x FROM unnest(coalesce(e.eligible_classes,'{}'::uuid[])) x
                   WHERE NOT x = ANY(coalesce(e.coordinator_added_classes,'{}'::uuid[])));
  IF cardinality(_manual) = 0 AND cardinality(coalesce(e.coordinator_added_classes,'{}'::uuid[])) = 0 THEN
    RETURN; -- visible to all; keep it so
  END IF;
  _new := ARRAY(SELECT DISTINCT ptc.class_id FROM coordinator_assignments ca
                JOIN portfolio_teacher_classes ptc ON ptc.teacher_id = ca.teacher_id
                WHERE ca.event_id = _event_id AND NOT ptc.class_id = ANY(_manual));
  IF _new IS DISTINCT FROM e.coordinator_added_classes OR true THEN
    UPDATE events SET eligible_classes = _manual || _new, coordinator_added_classes = _new
     WHERE id = _event_id
       AND (coordinator_added_classes IS DISTINCT FROM _new OR NOT (eligible_classes @> (_manual || _new) AND (_manual || _new) @> eligible_classes));
  END IF;
END $$;

CREATE OR REPLACE FUNCTION public.trg_coordinator_assignment_sync()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  PERFORM sync_event_coordinator_classes(CASE WHEN TG_OP='DELETE' THEN OLD.event_id ELSE NEW.event_id END);
  RETURN NULL;
END $$;

DROP TRIGGER IF EXISTS coordinator_assignment_sync_classes ON public.coordinator_assignments;
CREATE TRIGGER coordinator_assignment_sync_classes AFTER INSERT OR DELETE ON public.coordinator_assignments
FOR EACH ROW EXECUTE FUNCTION public.trg_coordinator_assignment_sync();

CREATE OR REPLACE FUNCTION public.propagate_session_booking()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _id uuid;
BEGIN
  IF (NEW.booking_open_at IS DISTINCT FROM OLD.booking_open_at OR NEW.booking_close_at IS DISTINCT FROM OLD.booking_close_at)
     AND (NEW.booking_open_at IS NOT NULL OR NEW.booking_close_at IS NOT NULL) THEN
    UPDATE events SET booking_open_at = coalesce(NEW.booking_open_at, booking_open_at),
                      booking_close_at = coalesce(NEW.booking_close_at, booking_close_at)
     WHERE session_id = NEW.id;
  END IF;
  IF NEW.force_teacher_classes AND NOT coalesce(OLD.force_teacher_classes,false) THEN
    FOR _id IN SELECT id FROM events WHERE session_id = NEW.id LOOP
      PERFORM sync_event_coordinator_classes(_id);
    END LOOP;
  END IF;
  RETURN NEW;
END $$;

REVOKE EXECUTE ON FUNCTION public.sync_event_coordinator_classes(uuid) FROM PUBLIC, anon, authenticated;