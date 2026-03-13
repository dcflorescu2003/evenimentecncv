CREATE OR REPLACE FUNCTION public.get_events_reserved_counts(_event_ids uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_object_agg(event_id, cnt), '{}'::jsonb)
  FROM (
    SELECT event_id, count(*)::integer as cnt
    FROM reservations
    WHERE event_id = ANY(_event_ids) AND status = 'reserved'
    GROUP BY event_id
  ) sub
$$;