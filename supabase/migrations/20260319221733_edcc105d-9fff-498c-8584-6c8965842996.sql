
-- Create event_student_assistants table
CREATE TABLE public.event_student_assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(event_id, student_id)
);

ALTER TABLE public.event_student_assistants ENABLE ROW LEVEL SECURITY;

-- Admins: full access
CREATE POLICY "Admins manage event student assistants"
  ON public.event_student_assistants FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (has_role(auth.uid(), 'admin'::app_role));

-- Teachers: manage for own events
CREATE POLICY "Teachers manage assistants for own events"
  ON public.event_student_assistants FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'teacher'::app_role) AND is_event_creator(event_id, auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND is_event_creator(event_id, auth.uid()));

-- Homeroom teachers: manage for own events
CREATE POLICY "Homeroom teachers manage assistants for own events"
  ON public.event_student_assistants FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND is_event_creator(event_id, auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND is_event_creator(event_id, auth.uid()));

-- Coordinators: read for assigned events
CREATE POLICY "Coordinators read event assistants"
  ON public.event_student_assistants FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'coordinator_teacher'::app_role) AND is_coordinator_for_event(event_id, auth.uid()));

-- Students: read own assignments
CREATE POLICY "Students read own assistant assignments"
  ON public.event_student_assistants FOR SELECT TO authenticated
  USING (student_id = auth.uid());
