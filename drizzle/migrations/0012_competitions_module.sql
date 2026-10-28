CREATE TYPE public.competition_department AS ENUM ('matematica','limba_romana','engleza','franceza','informatica','geografie','istorie','fizica','chimie','religie','arte','stiinte_umaniste');
CREATE TYPE public.competition_stage AS ENUM ('locala','sector','municipiu','nationala','internationala');
CREATE TYPE public.competition_prize AS ENUM ('locul_1','locul_2','locul_3','mentiune','aur','argint','bronz','participare');

CREATE TABLE public.competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  department public.competition_department NOT NULL,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competitions TO authenticated;
GRANT ALL ON public.competitions TO service_role;
ALTER TABLE public.competitions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated read competitions" ON public.competitions FOR SELECT TO authenticated USING (true);
CREATE POLICY "Admin manage competitions" ON public.competitions FOR ALL TO authenticated
  USING (public.has_role((select auth.uid()), 'admin')) WITH CHECK (public.has_role((select auth.uid()), 'admin'));

CREATE TABLE public.competition_awards (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.competitions(id) ON DELETE RESTRICT,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL DEFAULT auth.uid(),
  stage public.competition_stage NOT NULL,
  prize public.competition_prize NOT NULL,
  academic_year text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX competition_awards_year_idx ON public.competition_awards(academic_year);
CREATE INDEX competition_awards_teacher_idx ON public.competition_awards(teacher_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.competition_awards TO authenticated;
GRANT ALL ON public.competition_awards TO service_role;
ALTER TABLE public.competition_awards ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Read awards" ON public.competition_awards FOR SELECT TO authenticated
  USING (teacher_id = (select auth.uid())
    OR public.has_role((select auth.uid()), 'admin')
    OR public.has_role((select auth.uid()), 'manager')
    OR public.has_role((select auth.uid()), 'cse'));
CREATE POLICY "Teachers insert own awards" ON public.competition_awards FOR INSERT TO authenticated
  WITH CHECK (teacher_id = (select auth.uid()) AND (
    public.has_role((select auth.uid()), 'teacher') OR public.has_role((select auth.uid()), 'homeroom_teacher')
    OR public.has_role((select auth.uid()), 'cse') OR public.has_role((select auth.uid()), 'admin')));
CREATE POLICY "Update own awards" ON public.competition_awards FOR UPDATE TO authenticated
  USING (teacher_id = (select auth.uid()) OR public.has_role((select auth.uid()), 'admin'))
  WITH CHECK (teacher_id = (select auth.uid()) OR public.has_role((select auth.uid()), 'admin'));
CREATE POLICY "Delete own awards" ON public.competition_awards FOR DELETE TO authenticated
  USING (teacher_id = (select auth.uid()) OR public.has_role((select auth.uid()), 'admin'));