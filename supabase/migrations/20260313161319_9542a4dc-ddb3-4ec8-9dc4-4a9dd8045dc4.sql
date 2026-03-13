CREATE OR REPLACE FUNCTION public.get_events_reserved_counts(_event_ids uuid[])
RETURNS jsonb
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $$
  SELECT COALESCE(jsonb_object_agg(event_id, total_cnt), '{}'::jsonb)
  FROM (
    SELECT event_id, SUM(cnt)::integer AS total_cnt
    FROM (
      SELECT r.event_id, count(*)::integer AS cnt
      FROM public.reservations r
      WHERE r.event_id = ANY(_event_ids)
        AND r.status = 'reserved'
      GROUP BY r.event_id

      UNION ALL

      SELECT pr.event_id, count(*)::integer AS cnt
      FROM public.public_tickets pt
      JOIN public.public_reservations pr ON pr.id = pt.public_reservation_id
      WHERE pr.event_id = ANY(_event_ids)
        AND pr.status = 'reserved'
        AND COALESCE(pt.status, 'reserved') <> 'cancelled'
      GROUP BY pr.event_id
    ) counts
    GROUP BY event_id
  ) aggregated
$$;