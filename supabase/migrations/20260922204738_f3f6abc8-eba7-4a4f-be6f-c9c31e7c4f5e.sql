CREATE OR REPLACE FUNCTION public.resolve_student_badge_public(_qr text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v jsonb;
  v_student uuid;
  v_rec record;
BEGIN
  v := public.resolve_student_qr(_qr);
  IF NOT COALESCE((v->>'ok')::boolean, false) THEN
    RETURN jsonb_build_object('ok', false, 'message', COALESCE(v->>'message', 'Cod QR invalid.'));
  END IF;

  v_student := (v->>'student_id')::uuid;

  SELECT p.id, p.first_name, p.last_name, p.display_name, p.student_identifier,
         (SELECT c.display_name
            FROM public.student_class_assignments sca
            JOIN public.classes c ON c.id = sca.class_id
           WHERE sca.student_id = p.id
           ORDER BY sca.academic_year DESC
           LIMIT 1) AS class_name
    INTO v_rec
    FROM public.profiles p
   WHERE p.id = v_student;

  IF v_rec.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Elev inexistent.');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'student_id', v_rec.id,
    'first_name', v_rec.first_name,
    'last_name', v_rec.last_name,
    'display_name', v_rec.display_name,
    'student_identifier', v_rec.student_identifier,
    'class', v_rec.class_name
  );
END;
$function$;

CREATE TABLE public.canteen_api_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  student_id uuid,
  ok boolean NOT NULL DEFAULT false,
  message text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.canteen_api_log TO authenticated;
GRANT ALL ON public.canteen_api_log TO service_role;

ALTER TABLE public.canteen_api_log ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins can view canteen api log"
ON public.canteen_api_log FOR SELECT TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

CREATE INDEX idx_canteen_api_log_created_at ON public.canteen_api_log (created_at DESC);