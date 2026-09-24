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
  DELETE FROM public.student_qr_tokens WHERE student_id = auth.uid() AND expires_at < now() - interval '5 minutes';
  v_token := replace(replace(replace(encode(gen_random_bytes(18), 'base64'), '+', 'A'), '/', 'B'), '=', '');
  v_expires := now() + interval '25 seconds';
  INSERT INTO public.student_qr_tokens (student_id, token, expires_at) VALUES (auth.uid(), v_token, v_expires);
  RETURN jsonb_build_object('success', true, 'token', v_token, 'expires_at', v_expires);
END;
$function$;

CREATE OR REPLACE FUNCTION public.resolve_student_badge_public(_qr text)
 RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public'
AS $function$
DECLARE v jsonb; v_id uuid; v_rec record; v_roles text[]; v_type text; v_class text;
BEGIN
  v := public.resolve_student_qr(_qr);
  IF NOT COALESCE((v->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'message', COALESCE(v->>'message', 'Cod QR invalid.'));
  END IF;
  v_id := (v->>'student_id')::uuid;
  SELECT p.id, p.first_name, p.last_name, p.display_name, p.student_identifier INTO v_rec
    FROM public.profiles p WHERE p.id = v_id;
  IF v_rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Utilizator inexistent.');
  END IF;
  SELECT array_agg(role::text) INTO v_roles FROM public.user_roles WHERE user_id = v_id;
  IF 'student' = ANY(COALESCE(v_roles,'{}')) THEN
    v_type := 'student';
    SELECT c.display_name INTO v_class FROM public.student_class_assignments sca
      JOIN public.classes c ON c.id = sca.class_id
      WHERE sca.student_id = v_id ORDER BY sca.academic_year DESC LIMIT 1;
  ELSE
    v_type := 'teacher';
    SELECT c.display_name INTO v_class FROM public.classes c
      WHERE c.homeroom_teacher_id = v_id AND c.is_active ORDER BY c.academic_year DESC LIMIT 1;
  END IF;
  RETURN jsonb_build_object('ok', true, 'student_id', v_rec.id, 'user_id', v_rec.id, 'user_type', v_type,
    'roles', to_jsonb(COALESCE(v_roles,'{}')), 'first_name', v_rec.first_name, 'last_name', v_rec.last_name,
    'display_name', v_rec.display_name, 'student_identifier', v_rec.student_identifier, 'class', v_class);
END;
$function$;