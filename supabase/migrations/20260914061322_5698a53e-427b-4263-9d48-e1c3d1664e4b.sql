
REVOKE EXECUTE ON FUNCTION public.mark_club_attendance_by_qr(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.mark_volunteer_attendance_by_qr(uuid, text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.self_checkin_club(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.self_checkin_volunteer(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.parse_student_qr(text) FROM anon, public;
REVOKE EXECUTE ON FUNCTION public.qr_auto_status(date, time) FROM anon, public;

GRANT EXECUTE ON FUNCTION public.mark_club_attendance_by_qr(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.mark_volunteer_attendance_by_qr(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.self_checkin_club(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.self_checkin_volunteer(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.parse_student_qr(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.qr_auto_status(date, time) TO authenticated;
