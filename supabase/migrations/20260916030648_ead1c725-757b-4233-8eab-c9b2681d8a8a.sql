-- SĂLI
CREATE TABLE public.vr_rooms (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  sort_order integer NOT NULL DEFAULT 0,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.vr_rooms TO authenticated;
GRANT ALL ON public.vr_rooms TO service_role;
ALTER TABLE public.vr_rooms ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vr_rooms_select" ON public.vr_rooms FOR SELECT TO authenticated USING (true);
CREATE POLICY "vr_rooms_admin" ON public.vr_rooms FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));
GRANT INSERT, UPDATE, DELETE ON public.vr_rooms TO authenticated;

INSERT INTO public.vr_rooms (name, sort_order) VALUES
  ('Sala 1',1),('Sala 2',2),('Sala 3',3),('Sala 4',4),('Sala 5',5),('Sala 6',6),
  ('Sala 7',7),('Sala 8',8),('Sala 9',9),('Sala 10',10),('Sala 11',11),('Sala 12',12),
  ('Lab. bio',13),('Lab. chimie',14),('Lab. fizică',15),('Amfiteatru',16);

-- MATERIALE
CREATE TABLE public.vr_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  subject text NOT NULL,
  name text NOT NULL,
  media_type text,
  size_label text,
  preview_url text,
  track_url text,
  track_id bigint UNIQUE,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX vr_materials_subject_idx ON public.vr_materials (subject);
CREATE INDEX vr_materials_name_idx ON public.vr_materials (lower(name));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vr_materials TO authenticated;
GRANT ALL ON public.vr_materials TO service_role;
ALTER TABLE public.vr_materials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vr_materials_select" ON public.vr_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "vr_materials_admin" ON public.vr_materials FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- VOLUNTARI
CREATE TABLE public.vr_volunteers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vr_volunteers TO authenticated;
GRANT ALL ON public.vr_volunteers TO service_role;
ALTER TABLE public.vr_volunteers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vr_volunteers_select" ON public.vr_volunteers FOR SELECT TO authenticated USING (true);
CREATE POLICY "vr_volunteers_admin" ON public.vr_volunteers FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin')) WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.is_vr_volunteer(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.vr_volunteers WHERE student_id = _user_id)
$$;

-- REZERVĂRI
CREATE TABLE public.vr_reservations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  date date NOT NULL,
  start_time time NOT NULL,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  room_id uuid NOT NULL REFERENCES public.vr_rooms(id),
  teacher_id uuid NOT NULL,
  notes text,
  status text NOT NULL DEFAULT 'active',
  prepared_at timestamptz,
  prepared_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX vr_reservations_slot_unique
  ON public.vr_reservations (date, start_time) WHERE status = 'active';
CREATE INDEX vr_reservations_date_idx ON public.vr_reservations (date);
CREATE INDEX vr_reservations_class_idx ON public.vr_reservations (class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vr_reservations TO authenticated;
GRANT ALL ON public.vr_reservations TO service_role;
ALTER TABLE public.vr_reservations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vr_res_select" ON public.vr_reservations FOR SELECT TO authenticated USING (true);
CREATE POLICY "vr_res_insert" ON public.vr_reservations FOR INSERT TO authenticated
  WITH CHECK (
    teacher_id = auth.uid() AND (
      public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'teacher')
      OR public.has_role(auth.uid(), 'homeroom_teacher') OR public.has_role(auth.uid(), 'cse')
      OR public.has_role(auth.uid(), 'coordinator_teacher')
    )
  );
CREATE POLICY "vr_res_update_own" ON public.vr_reservations FOR UPDATE TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));
CREATE POLICY "vr_res_delete_own" ON public.vr_reservations FOR DELETE TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER vr_reservations_updated_at BEFORE UPDATE ON public.vr_reservations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- MATERIALE PER REZERVARE
CREATE TABLE public.vr_reservation_materials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id uuid NOT NULL REFERENCES public.vr_reservations(id) ON DELETE CASCADE,
  material_id uuid NOT NULL REFERENCES public.vr_materials(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (reservation_id, material_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vr_reservation_materials TO authenticated;
GRANT ALL ON public.vr_reservation_materials TO service_role;
ALTER TABLE public.vr_reservation_materials ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_vr_reservation_owner(_user_id uuid, _reservation_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.vr_reservations r WHERE r.id = _reservation_id AND r.teacher_id = _user_id)
$$;

CREATE POLICY "vr_rm_select" ON public.vr_reservation_materials FOR SELECT TO authenticated USING (true);
CREATE POLICY "vr_rm_write" ON public.vr_reservation_materials FOR ALL TO authenticated
  USING (public.is_vr_reservation_owner(auth.uid(), reservation_id) OR public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_vr_reservation_owner(auth.uid(), reservation_id) OR public.has_role(auth.uid(), 'admin'));

-- MARCARE ECHIPAMENT PREGĂTIT (voluntar sau admin)
CREATE OR REPLACE FUNCTION public.vr_mark_prepared(_reservation_id uuid, _prepared boolean)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE _res public.vr_reservations%ROWTYPE;
BEGIN
  SELECT * INTO _res FROM public.vr_reservations WHERE id = _reservation_id;
  IF NOT FOUND THEN RETURN jsonb_build_object('ok', false, 'message', 'Rezervarea nu există.'); END IF;

  IF NOT (
    public.has_role(auth.uid(), 'admin')
    OR _res.teacher_id = auth.uid()
    OR EXISTS (SELECT 1 FROM public.vr_volunteers v WHERE v.class_id = _res.class_id AND v.student_id = auth.uid())
  ) THEN
    RETURN jsonb_build_object('ok', false, 'message', 'Nu ai dreptul să modifici această rezervare.');
  END IF;

  UPDATE public.vr_reservations
    SET prepared_at = CASE WHEN _prepared THEN now() ELSE NULL END,
        prepared_by = CASE WHEN _prepared THEN auth.uid() ELSE NULL END
    WHERE id = _reservation_id;

  RETURN jsonb_build_object('ok', true);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.vr_mark_prepared(uuid, boolean) FROM anon, public;
GRANT EXECUTE ON FUNCTION public.vr_mark_prepared(uuid, boolean) TO authenticated;