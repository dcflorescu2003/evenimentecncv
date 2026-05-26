
-- Subjects table
CREATE TABLE public.subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  short_name text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read subjects" ON public.subjects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage subjects" ON public.subjects
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER subjects_updated_at
  BEFORE UPDATE ON public.subjects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Teacher subjects link
CREATE TABLE public.teacher_subjects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  subject_id uuid NOT NULL REFERENCES public.subjects(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, subject_id)
);

CREATE INDEX teacher_subjects_teacher_idx ON public.teacher_subjects(teacher_id);
CREATE INDEX teacher_subjects_subject_idx ON public.teacher_subjects(subject_id);

ALTER TABLE public.teacher_subjects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated read teacher_subjects" ON public.teacher_subjects
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "Admins manage teacher_subjects" ON public.teacher_subjects
  FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Seed from existing schedule_entries (deduped, case-trimmed)
INSERT INTO public.subjects (name)
SELECT DISTINCT trim(subject)
FROM public.schedule_entries
WHERE subject IS NOT NULL AND trim(subject) <> ''
ON CONFLICT (name) DO NOTHING;
