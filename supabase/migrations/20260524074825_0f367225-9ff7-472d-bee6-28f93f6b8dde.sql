
CREATE TABLE public.class_schedules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  academic_year text NOT NULL,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (class_id, academic_year)
);

CREATE TABLE public.schedule_entries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  schedule_id uuid NOT NULL REFERENCES public.class_schedules(id) ON DELETE CASCADE,
  day_of_week int NOT NULL CHECK (day_of_week BETWEEN 1 AND 5),
  period int NOT NULL CHECK (period BETWEEN 1 AND 12),
  subject text NOT NULL,
  teacher_name text,
  room text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (schedule_id, day_of_week, period)
);

CREATE INDEX idx_schedule_entries_schedule ON public.schedule_entries(schedule_id);

ALTER TABLE public.class_schedules ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.schedule_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage class_schedules" ON public.class_schedules
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read class_schedules" ON public.class_schedules
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage schedule_entries" ON public.schedule_entries
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Authenticated read schedule_entries" ON public.schedule_entries
  FOR SELECT TO authenticated USING (true);

CREATE TRIGGER update_class_schedules_updated_at
  BEFORE UPDATE ON public.class_schedules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TABLE public.cantina_menu_cache (
  id int PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.cantina_menu_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read cantina menu" ON public.cantina_menu_cache
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Service role manages cantina menu" ON public.cantina_menu_cache
  FOR ALL TO public
  USING (auth.role() = 'service_role')
  WITH CHECK (auth.role() = 'service_role');
