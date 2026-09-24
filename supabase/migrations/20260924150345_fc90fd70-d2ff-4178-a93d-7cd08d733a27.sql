DROP POLICY IF EXISTS vr_res_insert ON public.vr_reservations;
CREATE POLICY vr_res_insert ON public.vr_reservations FOR INSERT TO authenticated
WITH CHECK (teacher_id = auth.uid() AND (has_role(auth.uid(),'admin') OR has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'homeroom_teacher') OR has_role(auth.uid(),'cse') OR has_role(auth.uid(),'manager')));