
-- ============================================
-- ENUMS
-- ============================================

CREATE TYPE public.app_role AS ENUM ('admin', 'student', 'homeroom_teacher', 'coordinator_teacher');
CREATE TYPE public.session_status AS ENUM ('draft', 'active', 'closed', 'archived');
CREATE TYPE public.event_status AS ENUM ('draft', 'published', 'closed', 'cancelled');
CREATE TYPE public.reservation_status AS ENUM ('reserved', 'cancelled');
CREATE TYPE public.ticket_status AS ENUM ('reserved', 'cancelled', 'present', 'late', 'absent', 'excused');
CREATE TYPE public.file_category AS ENUM ('event_dossier', 'form_template');
CREATE TYPE public.form_submission_status AS ENUM ('uploaded', 'reviewed', 'accepted', 'rejected');
CREATE TYPE public.import_batch_status AS ENUM ('pending', 'processing', 'completed', 'failed');

-- ============================================
-- UTILITY FUNCTIONS
-- ============================================

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

-- ============================================
-- PROFILES
-- ============================================

CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  first_name TEXT NOT NULL,
  last_name TEXT NOT NULL,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT GENERATED ALWAYS AS (first_name || ' ' || last_name) STORED,
  student_identifier TEXT,
  email TEXT,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- USER ROLES
-- ============================================

CREATE TABLE public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role app_role NOT NULL,
  UNIQUE (user_id, role)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- ============================================
-- SECURITY DEFINER: has_role
-- ============================================

CREATE OR REPLACE FUNCTION public.has_role(_user_id UUID, _role app_role)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role = _role
  )
$$;

-- ============================================
-- CLASSES
-- ============================================

CREATE TABLE public.classes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL,
  grade_number INT NOT NULL,
  section TEXT,
  display_name TEXT NOT NULL,
  homeroom_teacher_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.classes ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_classes_updated_at
  BEFORE UPDATE ON public.classes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- STUDENT CLASS ASSIGNMENTS
-- ============================================

CREATE TABLE public.student_class_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  academic_year TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (student_id, academic_year)
);

ALTER TABLE public.student_class_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- PROGRAM SESSIONS
-- ============================================

CREATE TABLE public.program_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  academic_year TEXT NOT NULL,
  name TEXT NOT NULL,
  start_date DATE NOT NULL,
  end_date DATE NOT NULL,
  status session_status NOT NULL DEFAULT 'draft',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.program_sessions ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_program_sessions_updated_at
  BEFORE UPDATE ON public.program_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- CLASS PARTICIPATION RULES
-- ============================================

CREATE TABLE public.class_participation_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  class_id UUID NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  session_id UUID NOT NULL REFERENCES public.program_sessions(id) ON DELETE CASCADE,
  requirement_type TEXT NOT NULL DEFAULT 'hours',
  required_value INT NOT NULL,
  enforcement_mode TEXT NOT NULL DEFAULT 'maximum_allowed_booking_and_required_target',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (class_id, session_id)
);

ALTER TABLE public.class_participation_rules ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_class_participation_rules_updated_at
  BEFORE UPDATE ON public.class_participation_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- EVENTS
-- ============================================

CREATE TABLE public.events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES public.program_sessions(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  computed_duration_display TEXT,
  counted_duration_hours INT NOT NULL,
  location TEXT,
  room_details TEXT,
  max_capacity INT NOT NULL CHECK (max_capacity > 0),
  published BOOLEAN NOT NULL DEFAULT false,
  booking_open_at TIMESTAMPTZ,
  booking_close_at TIMESTAMPTZ,
  status event_status NOT NULL DEFAULT 'draft',
  eligible_grades INT[],
  eligible_classes UUID[],
  notes_for_teachers TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT end_after_start CHECK (end_time > start_time)
);

ALTER TABLE public.events ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_events_updated_at
  BEFORE UPDATE ON public.events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- COORDINATOR ASSIGNMENTS
-- ============================================

CREATE TABLE public.coordinator_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (teacher_id, event_id)
);

ALTER TABLE public.coordinator_assignments ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RESERVATIONS
-- ============================================

CREATE TABLE public.reservations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  reservation_code TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status reservation_status NOT NULL DEFAULT 'reserved',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  cancelled_at TIMESTAMPTZ,
  UNIQUE (student_id, event_id)
);

ALTER TABLE public.reservations ENABLE ROW LEVEL SECURITY;

-- ============================================
-- TICKETS
-- ============================================

CREATE TABLE public.tickets (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  reservation_id UUID NOT NULL REFERENCES public.reservations(id) ON DELETE CASCADE UNIQUE,
  qr_code_data TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status ticket_status NOT NULL DEFAULT 'reserved',
  checkin_timestamp TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.tickets ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER update_tickets_updated_at
  BEFORE UPDATE ON public.tickets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- ATTENDANCE LOG
-- ============================================

CREATE TABLE public.attendance_log (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID NOT NULL REFERENCES public.tickets(id) ON DELETE CASCADE,
  previous_status ticket_status,
  new_status ticket_status NOT NULL,
  changed_by UUID NOT NULL REFERENCES auth.users(id),
  changed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  notes TEXT
);

ALTER TABLE public.attendance_log ENABLE ROW LEVEL SECURITY;

-- ============================================
-- EVENT FILES
-- ============================================

CREATE TABLE public.event_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  description TEXT,
  file_name TEXT NOT NULL,
  file_type TEXT,
  file_category file_category NOT NULL,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_required BOOLEAN NOT NULL DEFAULT false,
  notes TEXT,
  storage_path TEXT NOT NULL
);

ALTER TABLE public.event_files ENABLE ROW LEVEL SECURITY;

-- ============================================
-- FORM SUBMISSIONS
-- ============================================

CREATE TABLE public.form_submissions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id UUID NOT NULL REFERENCES public.events(id) ON DELETE CASCADE,
  student_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  related_template_id UUID REFERENCES public.event_files(id) ON DELETE SET NULL,
  form_title TEXT NOT NULL,
  file_name TEXT NOT NULL,
  file_type TEXT,
  uploaded_by UUID NOT NULL REFERENCES auth.users(id),
  uploaded_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  status form_submission_status NOT NULL DEFAULT 'uploaded',
  admin_notes TEXT,
  storage_path TEXT NOT NULL
);

ALTER TABLE public.form_submissions ENABLE ROW LEVEL SECURITY;

-- ============================================
-- IMPORT BATCHES
-- ============================================

CREATE TABLE public.import_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  imported_by UUID NOT NULL REFERENCES auth.users(id),
  imported_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  file_name TEXT NOT NULL,
  row_count INT NOT NULL DEFAULT 0,
  success_count INT NOT NULL DEFAULT 0,
  error_count INT NOT NULL DEFAULT 0,
  status import_batch_status NOT NULL DEFAULT 'pending',
  summary_json JSONB
);

ALTER TABLE public.import_batches ENABLE ROW LEVEL SECURITY;

-- ============================================
-- AUDIT LOGS
-- ============================================

CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id UUID,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- ============================================
-- RLS POLICIES
-- ============================================

-- profiles
CREATE POLICY "Users read own profile"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Users update own profile"
  ON public.profiles FOR UPDATE
  TO authenticated
  USING (id = auth.uid());

CREATE POLICY "Admins insert profiles"
  ON public.profiles FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Homeroom teachers read class students"
  ON public.profiles FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'homeroom_teacher')
    AND id IN (
      SELECT sca.student_id FROM public.student_class_assignments sca
      JOIN public.classes c ON c.id = sca.class_id
      WHERE c.homeroom_teacher_id = auth.uid()
    )
  );

-- user_roles
CREATE POLICY "Users read own roles"
  ON public.user_roles FOR SELECT
  TO authenticated
  USING (user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage roles"
  ON public.user_roles FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- classes
CREATE POLICY "Authenticated read classes"
  ON public.classes FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage classes"
  ON public.classes FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- student_class_assignments
CREATE POLICY "Students read own assignments"
  ON public.student_class_assignments FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Homeroom teachers read class assignments"
  ON public.student_class_assignments FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'homeroom_teacher')
    AND class_id IN (
      SELECT id FROM public.classes WHERE homeroom_teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage assignments"
  ON public.student_class_assignments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- program_sessions
CREATE POLICY "Authenticated read sessions"
  ON public.program_sessions FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage sessions"
  ON public.program_sessions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- class_participation_rules
CREATE POLICY "Authenticated read rules"
  ON public.class_participation_rules FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Admins manage rules"
  ON public.class_participation_rules FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- events
CREATE POLICY "Authenticated read published events"
  ON public.events FOR SELECT
  TO authenticated
  USING (
    (published = true AND status = 'published')
    OR public.has_role(auth.uid(), 'admin')
    OR (
      public.has_role(auth.uid(), 'coordinator_teacher')
      AND id IN (SELECT event_id FROM public.coordinator_assignments WHERE teacher_id = auth.uid())
    )
  );

CREATE POLICY "Admins manage events"
  ON public.events FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- coordinator_assignments
CREATE POLICY "Coordinators read own assignments"
  ON public.coordinator_assignments FOR SELECT
  TO authenticated
  USING (teacher_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage coordinator assignments"
  ON public.coordinator_assignments FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- reservations
CREATE POLICY "Students read own reservations"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students create own reservations"
  ON public.reservations FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid() AND public.has_role(auth.uid(), 'student'));

CREATE POLICY "Students update own reservations"
  ON public.reservations FOR UPDATE
  TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins manage reservations"
  ON public.reservations FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Coordinators read event reservations"
  ON public.reservations FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordinator_teacher')
    AND event_id IN (SELECT event_id FROM public.coordinator_assignments WHERE teacher_id = auth.uid())
  );

-- tickets
CREATE POLICY "Students read own tickets"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (
    reservation_id IN (SELECT id FROM public.reservations WHERE student_id = auth.uid())
    OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Coordinators read event tickets"
  ON public.tickets FOR SELECT
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordinator_teacher')
    AND reservation_id IN (
      SELECT r.id FROM public.reservations r
      JOIN public.coordinator_assignments ca ON ca.event_id = r.event_id
      WHERE ca.teacher_id = auth.uid()
    )
  );

CREATE POLICY "Admins manage tickets"
  ON public.tickets FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Coordinators update tickets"
  ON public.tickets FOR UPDATE
  TO authenticated
  USING (
    public.has_role(auth.uid(), 'coordinator_teacher')
    AND reservation_id IN (
      SELECT r.id FROM public.reservations r
      JOIN public.coordinator_assignments ca ON ca.event_id = r.event_id
      WHERE ca.teacher_id = auth.uid()
    )
  );

-- attendance_log
CREATE POLICY "Admins read attendance log"
  ON public.attendance_log FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins and coordinators insert attendance log"
  ON public.attendance_log FOR INSERT
  TO authenticated
  WITH CHECK (
    public.has_role(auth.uid(), 'admin')
    OR public.has_role(auth.uid(), 'coordinator_teacher')
  );

-- event_files
CREATE POLICY "Admins manage event files"
  ON public.event_files FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students read form templates"
  ON public.event_files FOR SELECT
  TO authenticated
  USING (
    file_category = 'form_template'
    AND event_id IN (
      SELECT id FROM public.events WHERE published = true AND status = 'published'
    )
  );

-- form_submissions
CREATE POLICY "Students read own submissions"
  ON public.form_submissions FOR SELECT
  TO authenticated
  USING (student_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students create own submissions"
  ON public.form_submissions FOR INSERT
  TO authenticated
  WITH CHECK (student_id = auth.uid() AND uploaded_by = auth.uid());

CREATE POLICY "Admins manage submissions"
  ON public.form_submissions FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- import_batches
CREATE POLICY "Admins manage import batches"
  ON public.import_batches FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- audit_logs
CREATE POLICY "Admins read audit logs"
  ON public.audit_logs FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- STORAGE
-- ============================================

INSERT INTO storage.buckets (id, name, public) VALUES ('event-files', 'event-files', false);

CREATE POLICY "Admins full access to event files storage"
  ON storage.objects FOR ALL
  TO authenticated
  USING (bucket_id = 'event-files' AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (bucket_id = 'event-files' AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Students read form templates from storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'event-files'
    AND (storage.foldername(name))[1] = 'form-templates'
  );

CREATE POLICY "Students upload form submissions to storage"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'event-files'
    AND (storage.foldername(name))[1] = 'form-submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

CREATE POLICY "Students read own submissions from storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'event-files'
    AND (storage.foldername(name))[1] = 'form-submissions'
    AND (storage.foldername(name))[2] = auth.uid()::text
  );

-- ============================================
-- SEED: 32 classes for 2025-2026
-- ============================================

INSERT INTO public.classes (academic_year, grade_number, section, display_name) VALUES
  ('2025-2026', 5, NULL, 'Clasa a V-a'),
  ('2025-2026', 6, NULL, 'Clasa a VI-a'),
  ('2025-2026', 7, NULL, 'Clasa a VII-a'),
  ('2025-2026', 8, NULL, 'Clasa a VIII-a'),
  ('2025-2026', 9, 'A', 'IX A'), ('2025-2026', 9, 'B', 'IX B'), ('2025-2026', 9, 'C', 'IX C'),
  ('2025-2026', 9, 'D', 'IX D'), ('2025-2026', 9, 'E', 'IX E'), ('2025-2026', 9, 'F', 'IX F'),
  ('2025-2026', 9, 'G', 'IX G'),
  ('2025-2026', 10, 'A', 'X A'), ('2025-2026', 10, 'B', 'X B'), ('2025-2026', 10, 'C', 'X C'),
  ('2025-2026', 10, 'D', 'X D'), ('2025-2026', 10, 'E', 'X E'), ('2025-2026', 10, 'F', 'X F'),
  ('2025-2026', 10, 'G', 'X G'),
  ('2025-2026', 11, 'A', 'XI A'), ('2025-2026', 11, 'B', 'XI B'), ('2025-2026', 11, 'C', 'XI C'),
  ('2025-2026', 11, 'D', 'XI D'), ('2025-2026', 11, 'E', 'XI E'), ('2025-2026', 11, 'F', 'XI F'),
  ('2025-2026', 11, 'G', 'XI G'),
  ('2025-2026', 12, 'A', 'XII A'), ('2025-2026', 12, 'B', 'XII B'), ('2025-2026', 12, 'C', 'XII C'),
  ('2025-2026', 12, 'D', 'XII D'), ('2025-2026', 12, 'E', 'XII E'), ('2025-2026', 12, 'F', 'XII F'),
  ('2025-2026', 12, 'G', 'XII G');

-- ============================================
-- INDEXES
-- ============================================

CREATE INDEX idx_student_class_assignments_student ON public.student_class_assignments(student_id);
CREATE INDEX idx_student_class_assignments_class ON public.student_class_assignments(class_id);
CREATE INDEX idx_reservations_student ON public.reservations(student_id);
CREATE INDEX idx_reservations_event ON public.reservations(event_id);
CREATE INDEX idx_tickets_reservation ON public.tickets(reservation_id);
CREATE INDEX idx_events_session ON public.events(session_id);
CREATE INDEX idx_events_date ON public.events(date);
CREATE INDEX idx_coordinator_assignments_teacher ON public.coordinator_assignments(teacher_id);
CREATE INDEX idx_coordinator_assignments_event ON public.coordinator_assignments(event_id);
CREATE INDEX idx_attendance_log_ticket ON public.attendance_log(ticket_id);
CREATE INDEX idx_audit_logs_entity ON public.audit_logs(entity_type, entity_id);
