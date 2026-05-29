CREATE POLICY "Authenticated read closed events"
ON public.events
FOR SELECT
TO authenticated
USING (status = 'closed' AND published = true);