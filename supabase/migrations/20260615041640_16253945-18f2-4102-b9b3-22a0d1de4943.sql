
-- 1) module_access table
CREATE TABLE public.module_access (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  module_key text NOT NULL,
  granted_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, module_key)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.module_access TO authenticated;
GRANT ALL ON public.module_access TO service_role;
ALTER TABLE public.module_access ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own module access"
  ON public.module_access FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage module access"
  ON public.module_access FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- 2) has_module_access helper
CREATE OR REPLACE FUNCTION public.has_module_access(_user_id uuid, _module_key text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR EXISTS (
        SELECT 1 FROM public.module_access
        WHERE user_id = _user_id AND module_key = _module_key
      )
$$;

-- 3) portfolio_teacher_classes
CREATE TABLE public.portfolio_teacher_classes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  academic_year text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(teacher_id, class_id, academic_year)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_teacher_classes TO authenticated;
GRANT ALL ON public.portfolio_teacher_classes TO service_role;
ALTER TABLE public.portfolio_teacher_classes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teacher reads own portfolio classes"
  ON public.portfolio_teacher_classes FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teacher manages own portfolio classes"
  ON public.portfolio_teacher_classes FOR ALL
  TO authenticated
  USING (
    (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'))
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'))
    OR public.has_role(auth.uid(), 'admin')
  );

-- 4) portfolio_student_notes
CREATE TABLE public.portfolio_student_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  note text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_student_notes TO authenticated;
GRANT ALL ON public.portfolio_student_notes TO service_role;
ALTER TABLE public.portfolio_student_notes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Teacher reads own student notes"
  ON public.portfolio_student_notes FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teacher manages own student notes"
  ON public.portfolio_student_notes FOR ALL
  TO authenticated
  USING (
    (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'))
    OR public.has_role(auth.uid(), 'admin')
  )
  WITH CHECK (
    (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'))
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER portfolio_student_notes_updated_at
  BEFORE UPDATE ON public.portfolio_student_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
