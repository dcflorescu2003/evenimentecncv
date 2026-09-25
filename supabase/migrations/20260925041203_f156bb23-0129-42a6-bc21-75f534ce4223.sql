CREATE OR REPLACE FUNCTION public.get_vr_reservation_teacher_names(_ids uuid[])
RETURNS TABLE(id uuid, first_name text, last_name text)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT p.id, p.first_name, p.last_name FROM public.profiles p
  WHERE p.id = ANY(_ids)
    AND EXISTS (SELECT 1 FROM public.vr_reservations r WHERE r.teacher_id = p.id);
$$;
REVOKE ALL ON FUNCTION public.get_vr_reservation_teacher_names(uuid[]) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_vr_reservation_teacher_names(uuid[]) TO authenticated, service_role;