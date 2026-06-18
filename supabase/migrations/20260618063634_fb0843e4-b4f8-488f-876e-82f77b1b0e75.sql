DROP POLICY IF EXISTS "Teachers read roles for assignment" ON public.user_roles;
DROP POLICY IF EXISTS "Homeroom teachers read roles for assignment" ON public.user_roles;
DROP POLICY IF EXISTS "CSE read roles for assignment" ON public.user_roles;

CREATE POLICY "Teachers read student roles for assignment"
ON public.user_roles FOR SELECT
USING (role = 'student'::app_role AND public.has_role(auth.uid(), 'teacher'::app_role));

CREATE POLICY "Homeroom teachers read student roles for assignment"
ON public.user_roles FOR SELECT
USING (role = 'student'::app_role AND public.has_role(auth.uid(), 'homeroom_teacher'::app_role));

CREATE POLICY "CSE read student roles for assignment"
ON public.user_roles FOR SELECT
USING (role = 'student'::app_role AND public.has_role(auth.uid(), 'cse'::app_role));