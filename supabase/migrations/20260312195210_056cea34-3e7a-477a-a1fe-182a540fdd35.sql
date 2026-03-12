
-- Add created_by column to events
ALTER TABLE public.events ADD COLUMN IF NOT EXISTS created_by uuid REFERENCES auth.users(id);

-- Teachers can create events
CREATE POLICY "Teachers create events" ON public.events
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND created_by = auth.uid());

-- Teachers manage own events (update)
CREATE POLICY "Teachers update own events" ON public.events
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND created_by = auth.uid())
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND created_by = auth.uid());

-- Teachers delete own events
CREATE POLICY "Teachers delete own events" ON public.events
FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND created_by = auth.uid());

-- Teachers read own events (including drafts)
CREATE POLICY "Teachers read own events" ON public.events
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND created_by = auth.uid());

-- Teachers manage coordinator_assignments for own events
CREATE POLICY "Teachers manage assignments for own events" ON public.coordinator_assignments
FOR ALL TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND event_id IN (SELECT id FROM events WHERE created_by = auth.uid()))
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role) AND event_id IN (SELECT id FROM events WHERE created_by = auth.uid()));

-- Teachers read own coordinator assignments
CREATE POLICY "Teachers read own assignments" ON public.coordinator_assignments
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND teacher_id = auth.uid());

-- Teachers read event tickets
CREATE POLICY "Teachers read event tickets" ON public.tickets
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND reservation_id IN (
  SELECT r.id FROM reservations r
  JOIN coordinator_assignments ca ON ca.event_id = r.event_id
  WHERE ca.teacher_id = auth.uid()
));

-- Teachers update event tickets
CREATE POLICY "Teachers update event tickets" ON public.tickets
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND reservation_id IN (
  SELECT r.id FROM reservations r
  JOIN coordinator_assignments ca ON ca.event_id = r.event_id
  WHERE ca.teacher_id = auth.uid()
));

-- Teachers insert attendance log
CREATE POLICY "Teachers insert attendance log" ON public.attendance_log
FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'teacher'::app_role));

-- Teachers read event reservations
CREATE POLICY "Teachers read event reservations" ON public.reservations
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND event_id IN (
  SELECT ca.event_id FROM coordinator_assignments ca WHERE ca.teacher_id = auth.uid()
));

-- Teachers read participant profiles
CREATE POLICY "Teachers read event participant profiles" ON public.profiles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND id IN (
  SELECT r.student_id FROM reservations r
  JOIN coordinator_assignments ca ON ca.event_id = r.event_id
  WHERE ca.teacher_id = auth.uid()
));

-- Teachers read teacher/coordinator profiles for assigning
CREATE POLICY "Teachers read teacher profiles" ON public.profiles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND id IN (
  SELECT ur.user_id FROM user_roles ur WHERE ur.role IN ('teacher', 'coordinator_teacher')
));

-- Teachers read user_roles for searching assignable teachers
CREATE POLICY "Teachers read roles for assignment" ON public.user_roles
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role));

-- Teachers read public reservations
CREATE POLICY "Teachers read public reservations" ON public.public_reservations
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND event_id IN (
  SELECT ca.event_id FROM coordinator_assignments ca WHERE ca.teacher_id = auth.uid()
));

-- Teachers read public tickets
CREATE POLICY "Teachers read public tickets" ON public.public_tickets
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND public_reservation_id IN (
  SELECT pr.id FROM public_reservations pr
  JOIN coordinator_assignments ca ON ca.event_id = pr.event_id
  WHERE ca.teacher_id = auth.uid()
));

-- Teachers update public tickets
CREATE POLICY "Teachers update public tickets" ON public.public_tickets
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'teacher'::app_role) AND public_reservation_id IN (
  SELECT pr.id FROM public_reservations pr
  JOIN coordinator_assignments ca ON ca.event_id = pr.event_id
  WHERE ca.teacher_id = auth.uid()
));
