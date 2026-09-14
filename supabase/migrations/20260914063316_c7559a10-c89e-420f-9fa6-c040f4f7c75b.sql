CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.issue_student_qr()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions
AS $$
DECLARE
  v_token text;
  v_expires timestamptz;
BEGIN
  IF auth.uid() IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Neautentificat.');
  END IF;

  DELETE FROM public.student_qr_tokens
  WHERE student_id = auth.uid() AND expires_at < now() - interval '5 minutes';

  v_token := replace(replace(replace(encode(gen_random_bytes(18), 'base64'), '+', 'A'), '/', 'B'), '=', '');
  v_expires := now() + interval '25 seconds';

  INSERT INTO public.student_qr_tokens (student_id, token, expires_at)
  VALUES (auth.uid(), v_token, v_expires);

  RETURN jsonb_build_object('success', true, 'token', v_token, 'expires_at', v_expires);
END;
$$;

REVOKE EXECUTE ON FUNCTION public.issue_student_qr() FROM anon, public;
GRANT EXECUTE ON FUNCTION public.issue_student_qr() TO authenticated;