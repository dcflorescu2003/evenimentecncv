
-- 1. Drop overly broad anon SELECT policies
DROP POLICY IF EXISTS "Anon select own public reservations" ON public.public_reservations;
DROP POLICY IF EXISTS "Anon select public tickets" ON public.public_tickets;

-- 2. Create a security-definer RPC for guest reservation lookup by code
CREATE OR REPLACE FUNCTION public.lookup_public_reservation(p_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reservation public.public_reservations%ROWTYPE;
  v_tickets jsonb;
  v_event jsonb;
BEGIN
  IF p_code IS NULL OR length(p_code) < 6 THEN
    RETURN NULL;
  END IF;

  SELECT * INTO v_reservation
  FROM public.public_reservations
  WHERE reservation_code = p_code
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN NULL;
  END IF;

  SELECT COALESCE(jsonb_agg(to_jsonb(t.*) ORDER BY t.created_at), '[]'::jsonb)
  INTO v_tickets
  FROM public.public_tickets t
  WHERE t.public_reservation_id = v_reservation.id;

  SELECT to_jsonb(sub)
  INTO v_event
  FROM (
    SELECT e.id, e.title, e.date, e.start_time, e.end_time, e.location
    FROM public.events e
    WHERE e.id = v_reservation.event_id
  ) sub;

  RETURN jsonb_build_object(
    'reservation', to_jsonb(v_reservation),
    'tickets', v_tickets,
    'event', v_event
  );
END;
$$;

REVOKE ALL ON FUNCTION public.lookup_public_reservation(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_public_reservation(text) TO anon, authenticated;

-- 3. Drop overly broad storage policy for form-templates folder
DROP POLICY IF EXISTS "Students read form templates from storage" ON storage.objects;
