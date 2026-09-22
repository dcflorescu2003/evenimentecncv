REVOKE EXECUTE ON FUNCTION public.resolve_student_badge_public(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.resolve_student_badge_public(text) TO service_role;