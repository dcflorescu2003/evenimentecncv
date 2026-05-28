CREATE OR REPLACE FUNCTION public.get_feedback_teachers()
RETURNS TABLE(id uuid, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.id, p.first_name, p.last_name
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE ur.role IN ('teacher','homeroom_teacher','coordinator_teacher')
    AND COALESCE(p.is_active, true) = true
  ORDER BY p.last_name, p.first_name;
$$;

GRANT EXECUTE ON FUNCTION public.get_feedback_teachers() TO authenticated;