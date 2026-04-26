-- Add is_cse column to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS is_cse boolean NOT NULL DEFAULT false;

-- events
CREATE POLICY "CSE create events"
  ON public.events FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND created_by = auth.uid());

CREATE POLICY "CSE read own events"
  ON public.events FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND created_by = auth.uid());

CREATE POLICY "CSE update own events"
  ON public.events FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND created_by = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND created_by = auth.uid());

CREATE POLICY "CSE delete own events"
  ON public.events FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND created_by = auth.uid());

-- coordinator_assignments
CREATE POLICY "CSE manage assignments for own events"
  ON public.coordinator_assignments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND is_event_creator(event_id, auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND is_event_creator(event_id, auth.uid()));

-- event_student_assistants
CREATE POLICY "CSE manage assistants for own events"
  ON public.event_student_assistants FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND is_event_creator(event_id, auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND is_event_creator(event_id, auth.uid()));

-- event_files
CREATE POLICY "CSE manage event files"
  ON public.event_files FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND is_event_creator(event_id, auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND is_event_creator(event_id, auth.uid()));

-- reservations
CREATE POLICY "CSE read event reservations"
  ON public.reservations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND is_event_creator(event_id, auth.uid()));

-- tickets
CREATE POLICY "CSE read event tickets"
  ON public.tickets FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'cse'::app_role)
    AND reservation_id IN (
      SELECT r.id FROM public.reservations r
      WHERE is_event_creator(r.event_id, auth.uid())
    )
  );

CREATE POLICY "CSE update event tickets"
  ON public.tickets FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'cse'::app_role)
    AND reservation_id IN (
      SELECT r.id FROM public.reservations r
      WHERE is_event_creator(r.event_id, auth.uid())
    )
  );

-- public_reservations
CREATE POLICY "CSE read public reservations"
  ON public.public_reservations FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND is_event_creator(event_id, auth.uid()));

-- public_tickets
CREATE POLICY "CSE read public tickets"
  ON public.public_tickets FOR SELECT TO authenticated
  USING (
    has_role(auth.uid(), 'cse'::app_role)
    AND public_reservation_id IN (
      SELECT pr.id FROM public.public_reservations pr
      WHERE is_event_creator(pr.event_id, auth.uid())
    )
  );

CREATE POLICY "CSE update public tickets"
  ON public.public_tickets FOR UPDATE TO authenticated
  USING (
    has_role(auth.uid(), 'cse'::app_role)
    AND public_reservation_id IN (
      SELECT pr.id FROM public.public_reservations pr
      WHERE is_event_creator(pr.event_id, auth.uid())
    )
  );

-- attendance_log insert
CREATE POLICY "CSE insert attendance log"
  ON public.attendance_log FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role));