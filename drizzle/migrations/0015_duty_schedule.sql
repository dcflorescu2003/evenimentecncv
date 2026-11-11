CREATE TABLE public.duty_schedule (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  week_slot text NOT NULL CHECK (week_slot IN ('A','B')),
  weekday smallint NOT NULL CHECK (weekday BETWEEN 1 AND 5),
  shift text NOT NULL CHECK (shift IN ('morning','afternoon')),
  position smallint NOT NULL CHECK (position IN (1,2)),
  teacher_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (week_slot, weekday, shift, position)
);
CREATE TABLE public.duty_settings (
  id boolean PRIMARY KEY DEFAULT true CHECK (id),
  anchor_monday date NOT NULL DEFAULT '2026-11-09',
  updated_at timestamptz NOT NULL DEFAULT now()
);
INSERT INTO public.duty_settings (id) VALUES (true);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.duty_schedule TO authenticated;
GRANT SELECT, UPDATE ON public.duty_settings TO authenticated;
GRANT ALL ON public.duty_schedule TO service_role;
GRANT ALL ON public.duty_settings TO service_role;
ALTER TABLE public.duty_schedule ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.duty_settings ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.can_view_duty_schedule(_uid uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _uid AND role IN ('admin','teacher','homeroom_teacher'))
      OR public.has_module_access(_uid, 'duty_editor')
$$;

CREATE POLICY "duty view" ON public.duty_schedule FOR SELECT TO authenticated
  USING (public.can_view_duty_schedule((select auth.uid())));
CREATE POLICY "duty edit ins" ON public.duty_schedule FOR INSERT TO authenticated
  WITH CHECK (public.has_module_access((select auth.uid()), 'duty_editor'));
CREATE POLICY "duty edit upd" ON public.duty_schedule FOR UPDATE TO authenticated
  USING (public.has_module_access((select auth.uid()), 'duty_editor'))
  WITH CHECK (public.has_module_access((select auth.uid()), 'duty_editor'));
CREATE POLICY "duty edit del" ON public.duty_schedule FOR DELETE TO authenticated
  USING (public.has_module_access((select auth.uid()), 'duty_editor'));
CREATE POLICY "duty settings view" ON public.duty_settings FOR SELECT TO authenticated
  USING (public.can_view_duty_schedule((select auth.uid())));
CREATE POLICY "duty settings edit" ON public.duty_settings FOR UPDATE TO authenticated
  USING (public.has_module_access((select auth.uid()), 'duty_editor'))
  WITH CHECK (public.has_module_access((select auth.uid()), 'duty_editor'));