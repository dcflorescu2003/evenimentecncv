CREATE OR REPLACE FUNCTION public.get_teacher_initials_map()
RETURNS TABLE(initials text, first_name text, last_name text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.initials, p.first_name, p.last_name
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE p.initials IS NOT NULL
    AND p.initials <> ''
    AND ur.role IN ('teacher','homeroom_teacher','coordinator_teacher');
$$;

REVOKE ALL ON FUNCTION public.get_teacher_initials_map() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_teacher_initials_map() TO authenticated;