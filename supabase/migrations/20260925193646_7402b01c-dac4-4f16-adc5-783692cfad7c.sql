REVOKE EXECUTE ON FUNCTION public.can_view_internal_event(uuid, uuid) FROM anon;
REVOKE EXECUTE ON FUNCTION public.search_students_for_event(uuid, text, integer) FROM anon;
REVOKE EXECUTE ON FUNCTION public.manually_enroll_event_student(uuid, uuid) FROM anon;