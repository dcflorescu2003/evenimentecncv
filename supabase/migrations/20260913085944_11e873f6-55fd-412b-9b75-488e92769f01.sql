DROP POLICY IF EXISTS "CSE manage coordinators for own clubs" ON public.club_coordinators;
CREATE POLICY "CSE manage club coordinators" ON public.club_coordinators FOR ALL TO authenticated
USING (public.has_role(auth.uid(), 'cse'))
WITH CHECK (public.has_role(auth.uid(), 'cse'));