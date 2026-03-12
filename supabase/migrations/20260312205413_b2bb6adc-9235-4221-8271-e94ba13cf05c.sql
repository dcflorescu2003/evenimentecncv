
-- RLS policies for homeroom_teacher to create/manage events
CREATE POLICY "Homeroom teachers create events" ON public.events
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND created_by = auth.uid());

CREATE POLICY "Homeroom teachers read own events" ON public.events
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND created_by = auth.uid());

CREATE POLICY "Homeroom teachers update own events" ON public.events
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND created_by = auth.uid());

CREATE POLICY "Homeroom teachers delete own events" ON public.events
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND created_by = auth.uid());

-- RLS for homeroom_teacher on coordinator_assignments (manage own events)
CREATE POLICY "Homeroom teachers manage assignments for own events" ON public.coordinator_assignments
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND is_event_creator(event_id, auth.uid()))
WITH CHECK (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND is_event_creator(event_id, auth.uid()));

-- Homeroom teachers read own coordinator assignments
CREATE POLICY "Homeroom teachers read own assignments" ON public.coordinator_assignments
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND teacher_id = auth.uid());

-- RLS for homeroom_teacher on event_files (manage files on own events)
CREATE POLICY "Homeroom teachers manage event files" ON public.event_files
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND is_event_creator(event_id, auth.uid()))
WITH CHECK (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND is_event_creator(event_id, auth.uid()));

-- RLS for teacher on event_files (manage files on own events)
CREATE POLICY "Teachers manage event files" ON public.event_files
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND is_event_creator(event_id, auth.uid()))
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND is_event_creator(event_id, auth.uid()));

-- RLS for homeroom_teacher on attendance_log
CREATE POLICY "Homeroom teachers insert attendance log" ON public.attendance_log
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'homeroom_teacher'::app_role));

-- Homeroom teachers read user_roles for assignment purposes
CREATE POLICY "Homeroom teachers read roles for assignment" ON public.user_roles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'homeroom_teacher'::app_role));

-- Homeroom teachers read teacher profiles for coordinator assignment
CREATE POLICY "Homeroom teachers read teacher profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'homeroom_teacher'::app_role) AND
  id IN (SELECT ur.user_id FROM user_roles ur WHERE ur.role = ANY(ARRAY['teacher'::app_role, 'coordinator_teacher'::app_role, 'homeroom_teacher'::app_role]))
);

-- Homeroom teachers read event participant profiles
CREATE POLICY "Homeroom teachers read event participant profiles" ON public.profiles
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'homeroom_teacher'::app_role) AND
  id IN (
    SELECT r.student_id FROM reservations r
    JOIN coordinator_assignments ca ON ca.event_id = r.event_id
    WHERE ca.teacher_id = auth.uid()
  )
);

-- Homeroom teachers read event reservations (as coordinator)
CREATE POLICY "Homeroom teachers read event reservations" ON public.reservations
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'homeroom_teacher'::app_role) AND
  event_id IN (SELECT ca.event_id FROM coordinator_assignments ca WHERE ca.teacher_id = auth.uid())
);

-- Homeroom teachers read event tickets
CREATE POLICY "Homeroom teachers read event tickets" ON public.tickets
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'homeroom_teacher'::app_role) AND
  reservation_id IN (
    SELECT r.id FROM reservations r
    JOIN coordinator_assignments ca ON ca.event_id = r.event_id
    WHERE ca.teacher_id = auth.uid()
  )
);

-- Homeroom teachers update event tickets
CREATE POLICY "Homeroom teachers update event tickets" ON public.tickets
FOR UPDATE TO authenticated
USING (
  has_role(auth.uid(), 'homeroom_teacher'::app_role) AND
  reservation_id IN (
    SELECT r.id FROM reservations r
    JOIN coordinator_assignments ca ON ca.event_id = r.event_id
    WHERE ca.teacher_id = auth.uid()
  )
);
