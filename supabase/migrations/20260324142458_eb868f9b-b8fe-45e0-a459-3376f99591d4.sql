
-- 1. Security definer function to check if a student is an assistant for an event
CREATE OR REPLACE FUNCTION public.is_assistant_for_event(_student_id uuid, _event_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.event_student_assistants
    WHERE student_id = _student_id AND event_id = _event_id
  )
$$;

-- 2. Assistants can read reservations for their events
CREATE POLICY "Assistants read event reservations"
ON public.reservations FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND is_assistant_for_event(auth.uid(), event_id)
);

-- 3. Assistants can read tickets for their events
CREATE POLICY "Assistants read event tickets"
ON public.tickets FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND reservation_id IN (
    SELECT r.id FROM public.reservations r
    WHERE is_assistant_for_event(auth.uid(), r.event_id)
  )
);

-- 4. Assistants can update tickets for their events
CREATE POLICY "Assistants update event tickets"
ON public.tickets FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND reservation_id IN (
    SELECT r.id FROM public.reservations r
    WHERE is_assistant_for_event(auth.uid(), r.event_id)
  )
);

-- 5. Assistants can insert attendance_log
CREATE POLICY "Assistants insert attendance log"
ON public.attendance_log FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'student'::app_role)
);

-- 6. Assistants can read public_reservations for their events
CREATE POLICY "Assistants read public reservations"
ON public.public_reservations FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND is_assistant_for_event(auth.uid(), event_id)
);

-- 7. Assistants can read public_tickets for their events
CREATE POLICY "Assistants read public tickets"
ON public.public_tickets FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND public_reservation_id IN (
    SELECT pr.id FROM public.public_reservations pr
    WHERE is_assistant_for_event(auth.uid(), pr.event_id)
  )
);

-- 8. Assistants can update public_tickets for their events
CREATE POLICY "Assistants update public tickets"
ON public.public_tickets FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND public_reservation_id IN (
    SELECT pr.id FROM public.public_reservations pr
    WHERE is_assistant_for_event(auth.uid(), pr.event_id)
  )
);

-- 9. Assistants can read profiles of event participants
CREATE POLICY "Assistants read event participant profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND id IN (
    SELECT r.student_id FROM public.reservations r
    WHERE is_assistant_for_event(auth.uid(), r.event_id)
  )
);

-- 10. Assistants can read student_class_assignments for event participants
CREATE POLICY "Assistants read student class assignments"
ON public.student_class_assignments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND student_id IN (
    SELECT r.student_id FROM public.reservations r
    WHERE is_assistant_for_event(auth.uid(), r.event_id)
  )
);
