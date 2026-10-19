CREATE OR REPLACE FUNCTION public.get_my_tickets()
RETURNS jsonb LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT COALESCE(jsonb_agg(
    to_jsonb(r) || jsonb_build_object('events', to_jsonb(e), 'tickets', to_jsonb(t))
    ORDER BY r.created_at DESC), '[]'::jsonb)
  FROM public.reservations r
  LEFT JOIN public.events e ON e.id = r.event_id
  LEFT JOIN LATERAL (SELECT * FROM public.tickets tt WHERE tt.reservation_id = r.id LIMIT 1) t ON true
  WHERE auth.uid() IS NOT NULL AND r.student_id = auth.uid();
$$;
REVOKE ALL ON FUNCTION public.get_my_tickets() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_my_tickets() TO authenticated;

CREATE OR REPLACE FUNCTION public.issue_student_qr()
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_token text; v_expires timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Neautentificat.');
  END IF;
  IF NOT (public.has_role(auth.uid(),'student') OR public.has_role(auth.uid(),'teacher') OR public.has_role(auth.uid(),'homeroom_teacher')) THEN
    RETURN jsonb_build_object('success', false, 'message', 'Legitimația nu este disponibilă pentru acest cont.');
  END IF;
  v_token := replace(replace(replace(encode(gen_random_bytes(18), 'base64'), '+', 'A'), '/', 'B'), '=', '');
  v_expires := now() + interval '25 seconds';
  INSERT INTO public.student_qr_tokens (student_id, token, expires_at) VALUES (auth.uid(), v_token, v_expires);
  RETURN jsonb_build_object('success', true, 'token', v_token, 'expires_at', v_expires);
END;
$function$;

CREATE INDEX IF NOT EXISTS idx_student_qr_tokens_expires ON public.student_qr_tokens (expires_at);

SELECT cron.schedule('cleanup-student-qr-tokens', '30 3 * * *',
  $$DELETE FROM public.student_qr_tokens WHERE expires_at < now() - interval '1 day'$$);