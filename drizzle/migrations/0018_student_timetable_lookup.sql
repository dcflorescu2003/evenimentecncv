CREATE OR REPLACE FUNCTION public.search_students_for_timetable(_term text, _limit integer DEFAULT 20)
RETURNS TABLE (student_id uuid, first_name text, last_name text, class_id uuid, class_name text, academic_year text)
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public, extensions
AS $$
DECLARE q text := public.f_unaccent(trim(coalesce(_term,''))); uid uuid := auth.uid();
BEGIN
 IF uid IS NULL OR public.has_role(uid,'cse') OR NOT (public.has_role(uid,'admin') OR public.has_role(uid,'teacher') OR public.has_role(uid,'homeroom_teacher')) THEN
  RAISE EXCEPTION 'Nu ai acces la căutarea elevilor pentru orar.' USING ERRCODE = '42501';
 END IF;
 IF length(q) < 2 THEN RETURN; END IF;
 q := replace(replace(replace(q, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_');
 RETURN QUERY
 SELECT p.id,p.first_name,p.last_name,a.class_id,c.display_name,c.academic_year
 FROM public.profiles p
 JOIN LATERAL (
  SELECT sca.class_id,sca.academic_year FROM public.student_class_assignments sca
  JOIN public.classes cl ON cl.id=sca.class_id AND cl.is_active AND cl.academic_year=sca.academic_year
  WHERE sca.student_id=p.id ORDER BY sca.academic_year DESC, sca.created_at DESC, sca.id LIMIT 1
 ) a ON true
 JOIN public.classes c ON c.id=a.class_id
 WHERE p.is_active AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role='student')
 AND (public.f_unaccent(p.last_name || ' ' || p.first_name) LIKE '%' || q || '%' OR public.f_unaccent(p.first_name || ' ' || p.last_name) LIKE '%' || q || '%')
 ORDER BY p.last_name COLLATE "ro-RO-x-icu",p.first_name COLLATE "ro-RO-x-icu",p.id
 LIMIT greatest(1,least(coalesce(_limit,20),50));
END;
$$;
REVOKE ALL ON FUNCTION public.search_students_for_timetable(text,integer) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.search_students_for_timetable(text,integer) TO authenticated;
GRANT ALL ON FUNCTION public.search_students_for_timetable(text,integer) TO service_role;