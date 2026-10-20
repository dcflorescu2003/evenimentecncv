CREATE OR REPLACE FUNCTION public.scan_event_ticket(_event_id uuid, _qr text)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _ev record; _t record; _st ticket_status; _name text;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Neautentificat'; END IF;
  IF NOT (has_role(_uid,'admin') OR is_event_creator(_event_id,_uid) OR is_coordinator_for_event(_event_id,_uid) OR is_assistant_for_event(_uid,_event_id)) THEN
    RETURN jsonb_build_object('success',false,'message','Nu ai drepturi pentru acest eveniment.');
  END IF;
  SELECT date, start_time INTO _ev FROM events WHERE id=_event_id;
  _st := CASE WHEN now() <= ((_ev.date + _ev.start_time) AT TIME ZONE 'Europe/Bucharest') + interval '15 minutes' THEN 'present' ELSE 'late' END;

  SELECT t.id, t.status, r.event_id, trim(coalesce(p.last_name,'')||' '||coalesce(p.first_name,'')) AS nm
    INTO _t FROM tickets t JOIN reservations r ON r.id=t.reservation_id LEFT JOIN profiles p ON p.id=r.student_id
    WHERE t.qr_code_data=_qr;
  IF FOUND THEN
    IF _t.event_id <> _event_id THEN RETURN jsonb_build_object('success',false,'message','Biletul nu aparține acestui eveniment.'); END IF;
    IF _t.status <> 'reserved' THEN RETURN jsonb_build_object('success',false,'already',true,'status',_t.status,'name',_t.nm,'ticket_id',_t.id,'is_public',false); END IF;
    UPDATE tickets SET status=_st, checkin_timestamp=now() WHERE id=_t.id;
    INSERT INTO attendance_log(ticket_id,previous_status,new_status,changed_by,notes) VALUES (_t.id,'reserved',_st,_uid,'Scanare QR');
    RETURN jsonb_build_object('success',true,'status',_st,'name',_t.nm,'ticket_id',_t.id,'is_public',false);
  END IF;

  SELECT pt.id, pt.status, pr.event_id, pt.attendee_name AS nm INTO _t
    FROM public_tickets pt JOIN public_reservations pr ON pr.id=pt.public_reservation_id WHERE pt.qr_code_data=_qr LIMIT 1;
  IF FOUND THEN
    IF _t.event_id <> _event_id THEN RETURN jsonb_build_object('success',false,'message','Biletul nu aparține acestui eveniment.'); END IF;
    IF _t.status <> 'reserved' THEN RETURN jsonb_build_object('success',false,'already',true,'status',_t.status,'name',_t.nm||' (Vizitator)','ticket_id',_t.id,'is_public',true); END IF;
    UPDATE public_tickets SET status=_st, checkin_timestamp=now() WHERE id=_t.id;
    RETURN jsonb_build_object('success',true,'status',_st,'name',_t.nm||' (Vizitator)','ticket_id',_t.id,'is_public',true);
  END IF;
  RETURN jsonb_build_object('success',false,'message','Bilet negăsit.');
END $$;
REVOKE ALL ON FUNCTION public.scan_event_ticket(uuid,text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.scan_event_ticket(uuid,text) TO authenticated;

CREATE OR REPLACE FUNCTION public.set_public_ticket_attendance(_ticket_id uuid, _status ticket_status)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
DECLARE _uid uuid := auth.uid(); _event uuid;
BEGIN
  IF _uid IS NULL THEN RAISE EXCEPTION 'Neautentificat'; END IF;
  SELECT pr.event_id INTO _event FROM public_tickets pt JOIN public_reservations pr ON pr.id=pt.public_reservation_id WHERE pt.id=_ticket_id;
  IF _event IS NULL THEN RAISE EXCEPTION 'Biletul nu a fost găsit'; END IF;
  IF NOT (has_role(_uid,'admin') OR is_event_creator(_event,_uid) OR is_coordinator_for_event(_event,_uid) OR is_assistant_for_event(_uid,_event)) THEN
    RAISE EXCEPTION 'Nu ai drepturi pentru acest eveniment';
  END IF;
  UPDATE public_tickets SET status=_status, checkin_timestamp = CASE WHEN _status IN ('present','late') THEN now() ELSE NULL END WHERE id=_ticket_id;
END $$;
REVOKE ALL ON FUNCTION public.set_public_ticket_attendance(uuid,ticket_status) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.set_public_ticket_attendance(uuid,ticket_status) TO authenticated;