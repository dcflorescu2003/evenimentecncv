ALTER TYPE public.competition_department ADD VALUE IF NOT EXISTS 'biologie';
ALTER TYPE public.competition_department ADD VALUE IF NOT EXISTS 'sport';
ALTER TYPE public.competition_department ADD VALUE IF NOT EXISTS 'tehnologii';
ALTER TYPE public.competition_department ADD VALUE IF NOT EXISTS 'alte_limbi';
ALTER TYPE public.competition_department ADD VALUE IF NOT EXISTS 'socio_umane';
ALTER TYPE public.competition_department ADD VALUE IF NOT EXISTS 'interdisciplinar';
ALTER TYPE public.competition_department ADD VALUE IF NOT EXISTS 'proiecte_educative';
CREATE TYPE public.competition_category AS ENUM ('international','olimpiada_nationala','concurs_finantat','concurs_nefinantat');
ALTER TABLE public.competitions ADD COLUMN category public.competition_category;
DROP POLICY "Teachers insert own awards" ON public.competition_awards;
CREATE POLICY "Teachers insert own awards" ON public.competition_awards FOR INSERT TO authenticated
  WITH CHECK (teacher_id = (select auth.uid()) AND (
    public.has_role((select auth.uid()), 'teacher') OR public.has_role((select auth.uid()), 'homeroom_teacher')));