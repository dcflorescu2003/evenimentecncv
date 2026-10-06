CREATE OR REPLACE FUNCTION public.get_event_coordinator_names(_event_id uuid)
RETURNS TABLE(id uuid, first_name text, last_name text, is_creator boolean)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name, (p.id = e.created_by) AS is_creator
  FROM public.events e
  JOIN public.profiles p ON p.id = e.created_by
  WHERE e.id = _event_id
  UNION ALL
  SELECT p.id, p.first_name, p.last_name, false
  FROM public.coordinator_assignments ca
  JOIN public.profiles p ON p.id = ca.teacher_id
  WHERE ca.event_id = _event_id
  ORDER BY is_creator DESC, last_name, first_name;
$$;

REVOKE EXECUTE ON FUNCTION public.get_event_coordinator_names(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_event_coordinator_names(uuid) TO authenticated, service_role;