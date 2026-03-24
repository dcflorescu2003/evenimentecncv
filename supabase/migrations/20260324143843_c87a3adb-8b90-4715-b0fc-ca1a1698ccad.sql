
-- Drop all the problematic assistant policies
DROP POLICY IF EXISTS "Assistants read event reservations" ON public.reservations;
DROP POLICY IF EXISTS "Assistants read event tickets" ON public.tickets;
DROP POLICY IF EXISTS "Assistants update event tickets" ON public.tickets;
DROP POLICY IF EXISTS "Assistants insert attendance log" ON public.attendance_log;
DROP POLICY IF EXISTS "Assistants read public reservations" ON public.public_reservations;
DROP POLICY IF EXISTS "Assistants read public tickets" ON public.public_tickets;
DROP POLICY IF EXISTS "Assistants update public tickets" ON public.public_tickets;
DROP POLICY IF EXISTS "Assistants read event participant profiles" ON public.profiles;
DROP POLICY IF EXISTS "Assistants read student class assignments" ON public.student_class_assignments;

-- Create SECURITY DEFINER helper functions to avoid RLS recursion

-- Returns true if the user is an assistant for the event that this reservation belongs to
CREATE OR REPLACE FUNCTION public.is_assistant_for_reservation_event(_student_id uuid, _reservation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 
    FROM public.reservations r
    JOIN public.event_student_assistants esa ON esa.event_id = r.event_id
    WHERE r.id = _reservation_id 
      AND esa.student_id = _student_id
  )
$$;

-- Returns student IDs from events where the given user is an assistant
CREATE OR REPLACE FUNCTION public.get_assistant_event_student_ids(_assistant_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT r.student_id
  FROM public.event_student_assistants esa
  JOIN public.reservations r ON r.event_id = esa.event_id
  WHERE esa.student_id = _assistant_id
$$;

-- Returns true if the public reservation belongs to an event where the user is an assistant
CREATE OR REPLACE FUNCTION public.is_assistant_for_public_reservation(_student_id uuid, _public_reservation_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.public_reservations pr
    JOIN public.event_student_assistants esa ON esa.event_id = pr.event_id
    WHERE pr.id = _public_reservation_id
      AND esa.student_id = _student_id
  )
$$;

-- Re-create policies using SECURITY DEFINER functions (no inline subqueries on RLS tables)

-- Reservations: assistants can read reservations for their events
CREATE POLICY "Assistants read event reservations"
ON public.reservations FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND is_assistant_for_event(auth.uid(), event_id)
);

-- Tickets: assistants can read/update tickets via security definer
CREATE POLICY "Assistants read event tickets"
ON public.tickets FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND is_assistant_for_reservation_event(auth.uid(), reservation_id)
);

CREATE POLICY "Assistants update event tickets"
ON public.tickets FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND is_assistant_for_reservation_event(auth.uid(), reservation_id)
);

-- Attendance log: assistants can insert
CREATE POLICY "Assistants insert attendance log"
ON public.attendance_log FOR INSERT TO authenticated
WITH CHECK (
  has_role(auth.uid(), 'student'::app_role)
);

-- Public reservations: assistants can read for their events
CREATE POLICY "Assistants read public reservations"
ON public.public_reservations FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND is_assistant_for_event(auth.uid(), event_id)
);

-- Public tickets: assistants can read/update via security definer
CREATE POLICY "Assistants read public tickets"
ON public.public_tickets FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND is_assistant_for_public_reservation(auth.uid(), public_reservation_id)
);

CREATE POLICY "Assistants update public tickets"
ON public.public_tickets FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND is_assistant_for_public_reservation(auth.uid(), public_reservation_id)
);

-- Profiles: assistants can read participant profiles (via security definer function)
CREATE POLICY "Assistants read event participant profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND id IN (SELECT get_assistant_event_student_ids(auth.uid()))
);

-- Student class assignments: assistants can read (via security definer function)
CREATE POLICY "Assistants read student class assignments"
ON public.student_class_assignments FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'student'::app_role)
  AND student_id IN (SELECT get_assistant_event_student_ids(auth.uid()))
);
