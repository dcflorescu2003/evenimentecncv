
-- ============================================================
-- ENUMS
-- ============================================================
CREATE TYPE public.club_status AS ENUM ('draft', 'active', 'archived');
CREATE TYPE public.club_enrollment_status AS ENUM ('enrolled', 'withdrawn');
CREATE TYPE public.club_attendance_status AS ENUM ('present', 'late', 'absent');
CREATE TYPE public.volunteer_project_status AS ENUM ('draft', 'active', 'closed');

-- ============================================================
-- CLUBS
-- ============================================================
CREATE TABLE public.clubs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  frequency_label text,
  location text,
  max_capacity integer,
  eligible_grades integer[],
  eligible_classes uuid[],
  max_per_class integer,
  enrollment_open_at timestamptz,
  enrollment_close_at timestamptz,
  status public.club_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clubs TO authenticated;
GRANT ALL ON public.clubs TO service_role;
ALTER TABLE public.clubs ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_clubs_session ON public.clubs(session_id);
CREATE INDEX idx_clubs_status ON public.clubs(status);

CREATE TRIGGER clubs_updated_at BEFORE UPDATE ON public.clubs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- CLUB COORDINATORS
-- ============================================================
CREATE TABLE public.club_coordinators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(club_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_coordinators TO authenticated;
GRANT ALL ON public.club_coordinators TO service_role;
ALTER TABLE public.club_coordinators ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_club_coords_club ON public.club_coordinators(club_id);
CREATE INDEX idx_club_coords_user ON public.club_coordinators(user_id);

-- ============================================================
-- CLUB ENROLLMENTS
-- ============================================================
CREATE TABLE public.club_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  status public.club_enrollment_status NOT NULL DEFAULT 'enrolled',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_enrollments TO authenticated;
GRANT ALL ON public.club_enrollments TO service_role;
ALTER TABLE public.club_enrollments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_club_enroll_club ON public.club_enrollments(club_id);
CREATE INDEX idx_club_enroll_student ON public.club_enrollments(student_id);
CREATE UNIQUE INDEX uniq_club_enroll_active ON public.club_enrollments(club_id, student_id)
  WHERE status = 'enrolled';

CREATE TRIGGER club_enrollments_updated_at BEFORE UPDATE ON public.club_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- CLUB MEETINGS
-- ============================================================
CREATE TABLE public.club_meetings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text,
  notes text,
  qr_code_data text NOT NULL DEFAULT gen_random_uuid()::text UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_meetings TO authenticated;
GRANT ALL ON public.club_meetings TO service_role;
ALTER TABLE public.club_meetings ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_club_meet_club ON public.club_meetings(club_id);
CREATE INDEX idx_club_meet_date ON public.club_meetings(date);

CREATE TRIGGER club_meetings_updated_at BEFORE UPDATE ON public.club_meetings
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- CLUB ATTENDANCE
-- ============================================================
CREATE TABLE public.club_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meeting_id uuid NOT NULL REFERENCES public.club_meetings(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  status public.club_attendance_status NOT NULL DEFAULT 'absent',
  checkin_at timestamptz,
  marked_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meeting_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.club_attendance TO authenticated;
GRANT ALL ON public.club_attendance TO service_role;
ALTER TABLE public.club_attendance ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_club_att_meeting ON public.club_attendance(meeting_id);
CREATE INDEX idx_club_att_student ON public.club_attendance(student_id);

CREATE TRIGGER club_attendance_updated_at BEFORE UPDATE ON public.club_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- VOLUNTEER PROJECTS
-- ============================================================
CREATE TABLE public.volunteer_projects (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL,
  name text NOT NULL,
  description text,
  location text,
  start_date date NOT NULL,
  end_date date NOT NULL,
  enrollment_open_at timestamptz,
  enrollment_close_at timestamptz,
  max_capacity integer,
  eligible_grades integer[],
  eligible_classes uuid[],
  max_per_class integer,
  status public.volunteer_project_status NOT NULL DEFAULT 'draft',
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.volunteer_projects TO authenticated;
GRANT ALL ON public.volunteer_projects TO service_role;
ALTER TABLE public.volunteer_projects ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_vp_session ON public.volunteer_projects(session_id);
CREATE INDEX idx_vp_status ON public.volunteer_projects(status);

CREATE TRIGGER vp_updated_at BEFORE UPDATE ON public.volunteer_projects
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- VOLUNTEER COORDINATORS
-- ============================================================
CREATE TABLE public.volunteer_coordinators (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.volunteer_projects(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(project_id, user_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.volunteer_coordinators TO authenticated;
GRANT ALL ON public.volunteer_coordinators TO service_role;
ALTER TABLE public.volunteer_coordinators ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_vc_project ON public.volunteer_coordinators(project_id);
CREATE INDEX idx_vc_user ON public.volunteer_coordinators(user_id);

-- ============================================================
-- VOLUNTEER ENROLLMENTS
-- ============================================================
CREATE TABLE public.volunteer_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.volunteer_projects(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  status public.club_enrollment_status NOT NULL DEFAULT 'enrolled',
  enrolled_at timestamptz NOT NULL DEFAULT now(),
  withdrawn_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.volunteer_enrollments TO authenticated;
GRANT ALL ON public.volunteer_enrollments TO service_role;
ALTER TABLE public.volunteer_enrollments ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_ve_project ON public.volunteer_enrollments(project_id);
CREATE INDEX idx_ve_student ON public.volunteer_enrollments(student_id);
CREATE UNIQUE INDEX uniq_ve_active ON public.volunteer_enrollments(project_id, student_id)
  WHERE status = 'enrolled';

CREATE TRIGGER ve_updated_at BEFORE UPDATE ON public.volunteer_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- VOLUNTEER DAYS
-- ============================================================
CREATE TABLE public.volunteer_days (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.volunteer_projects(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  location text,
  notes text,
  qr_code_data text NOT NULL DEFAULT gen_random_uuid()::text UNIQUE,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.volunteer_days TO authenticated;
GRANT ALL ON public.volunteer_days TO service_role;
ALTER TABLE public.volunteer_days ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_vd_project ON public.volunteer_days(project_id);
CREATE INDEX idx_vd_date ON public.volunteer_days(date);

CREATE TRIGGER vd_updated_at BEFORE UPDATE ON public.volunteer_days
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- VOLUNTEER ATTENDANCE
-- ============================================================
CREATE TABLE public.volunteer_attendance (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  day_id uuid NOT NULL REFERENCES public.volunteer_days(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  status public.club_attendance_status NOT NULL DEFAULT 'absent',
  checkin_at timestamptz,
  marked_by uuid,
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(day_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.volunteer_attendance TO authenticated;
GRANT ALL ON public.volunteer_attendance TO service_role;
ALTER TABLE public.volunteer_attendance ENABLE ROW LEVEL SECURITY;
CREATE INDEX idx_va_day ON public.volunteer_attendance(day_id);
CREATE INDEX idx_va_student ON public.volunteer_attendance(student_id);

CREATE TRIGGER va_updated_at BEFORE UPDATE ON public.volunteer_attendance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================================
-- HELPER FUNCTIONS (SECURITY DEFINER)
-- ============================================================
CREATE OR REPLACE FUNCTION public.is_club_coordinator(_user_id uuid, _club_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_coordinators
    WHERE club_id = _club_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_club_enrolled(_user_id uuid, _club_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_enrollments
    WHERE club_id = _club_id AND student_id = _user_id AND status = 'enrolled'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_club_creator(_club_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clubs WHERE id = _club_id AND created_by = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_volunteer_coordinator(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.volunteer_coordinators
    WHERE project_id = _project_id AND user_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_volunteer_enrolled(_user_id uuid, _project_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.volunteer_enrollments
    WHERE project_id = _project_id AND student_id = _user_id AND status = 'enrolled'
  )
$$;

CREATE OR REPLACE FUNCTION public.is_volunteer_creator(_project_id uuid, _user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.volunteer_projects WHERE id = _project_id AND created_by = _user_id
  )
$$;

-- Resolves club_id from a meeting (used in RLS for attendance/meetings to avoid recursion)
CREATE OR REPLACE FUNCTION public.get_club_id_for_meeting(_meeting_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT club_id FROM public.club_meetings WHERE id = _meeting_id
$$;

CREATE OR REPLACE FUNCTION public.get_project_id_for_day(_day_id uuid)
RETURNS uuid LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT project_id FROM public.volunteer_days WHERE id = _day_id
$$;

-- ============================================================
-- ELIGIBILITY RPCS
-- ============================================================
CREATE OR REPLACE FUNCTION public.check_club_enrollment(_student_id uuid, _club_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _club record;
  _class_id uuid;
  _grade int;
  _count int;
  _class_count int;
BEGIN
  SELECT * INTO _club FROM clubs WHERE id = _club_id;
  IF _club IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Clubul nu a fost găsit');
  END IF;
  IF _club.status <> 'active' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Clubul nu este activ');
  END IF;
  IF _club.enrollment_open_at IS NOT NULL AND now() < _club.enrollment_open_at THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Înscrierile nu sunt deschise încă');
  END IF;
  IF _club.enrollment_close_at IS NOT NULL AND now() > _club.enrollment_close_at THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Înscrierile s-au închis');
  END IF;
  IF EXISTS (SELECT 1 FROM club_enrollments WHERE club_id = _club_id AND student_id = _student_id AND status = 'enrolled') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Ești deja înscris la acest club');
  END IF;
  IF _club.max_capacity IS NOT NULL THEN
    SELECT count(*) INTO _count FROM club_enrollments WHERE club_id = _club_id AND status = 'enrolled';
    IF _count >= _club.max_capacity THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Nu mai sunt locuri disponibile');
    END IF;
  END IF;
  SELECT class_id INTO _class_id FROM student_class_assignments
    WHERE student_id = _student_id ORDER BY created_at DESC LIMIT 1;
  IF _club.eligible_classes IS NOT NULL AND array_length(_club.eligible_classes, 1) > 0 THEN
    IF _class_id IS NULL OR NOT (_class_id::text = ANY(CAST(_club.eligible_classes AS text[]))) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Nu ești eligibil (restricție de clasă)');
    END IF;
  ELSIF _club.eligible_grades IS NOT NULL AND array_length(_club.eligible_grades, 1) > 0 THEN
    SELECT grade_number INTO _grade FROM classes WHERE id = _class_id;
    IF _grade IS NULL OR NOT (_grade = ANY(_club.eligible_grades)) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Nu ești eligibil (restricție de an)');
    END IF;
  END IF;
  IF _club.max_per_class IS NOT NULL AND _class_id IS NOT NULL THEN
    SELECT count(*) INTO _class_count
      FROM club_enrollments ce
      JOIN student_class_assignments sca ON sca.student_id = ce.student_id
      WHERE ce.club_id = _club_id AND ce.status = 'enrolled' AND sca.class_id = _class_id;
    IF _class_count >= _club.max_per_class THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Limita pentru clasa ta a fost atinsă');
    END IF;
  END IF;
  RETURN jsonb_build_object('allowed', true);
END;
$$;

CREATE OR REPLACE FUNCTION public.check_volunteer_enrollment(_student_id uuid, _project_id uuid)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  _p record;
  _class_id uuid;
  _grade int;
  _count int;
  _class_count int;
BEGIN
  SELECT * INTO _p FROM volunteer_projects WHERE id = _project_id;
  IF _p IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Proiectul nu a fost găsit');
  END IF;
  IF _p.status <> 'active' THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Proiectul nu este activ');
  END IF;
  IF _p.enrollment_open_at IS NOT NULL AND now() < _p.enrollment_open_at THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Înscrierile nu sunt deschise încă');
  END IF;
  IF _p.enrollment_close_at IS NOT NULL AND now() > _p.enrollment_close_at THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Înscrierile s-au închis');
  END IF;
  IF EXISTS (SELECT 1 FROM volunteer_enrollments WHERE project_id = _project_id AND student_id = _student_id AND status = 'enrolled') THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Ești deja înscris la acest proiect');
  END IF;
  IF _p.max_capacity IS NOT NULL THEN
    SELECT count(*) INTO _count FROM volunteer_enrollments WHERE project_id = _project_id AND status = 'enrolled';
    IF _count >= _p.max_capacity THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Nu mai sunt locuri disponibile');
    END IF;
  END IF;
  SELECT class_id INTO _class_id FROM student_class_assignments
    WHERE student_id = _student_id ORDER BY created_at DESC LIMIT 1;
  IF _p.eligible_classes IS NOT NULL AND array_length(_p.eligible_classes, 1) > 0 THEN
    IF _class_id IS NULL OR NOT (_class_id::text = ANY(CAST(_p.eligible_classes AS text[]))) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Nu ești eligibil (restricție de clasă)');
    END IF;
  ELSIF _p.eligible_grades IS NOT NULL AND array_length(_p.eligible_grades, 1) > 0 THEN
    SELECT grade_number INTO _grade FROM classes WHERE id = _class_id;
    IF _grade IS NULL OR NOT (_grade = ANY(_p.eligible_grades)) THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Nu ești eligibil (restricție de an)');
    END IF;
  END IF;
  IF _p.max_per_class IS NOT NULL AND _class_id IS NOT NULL THEN
    SELECT count(*) INTO _class_count
      FROM volunteer_enrollments ve
      JOIN student_class_assignments sca ON sca.student_id = ve.student_id
      WHERE ve.project_id = _project_id AND ve.status = 'enrolled' AND sca.class_id = _class_id;
    IF _class_count >= _p.max_per_class THEN
      RETURN jsonb_build_object('allowed', false, 'reason', 'Limita pentru clasa ta a fost atinsă');
    END IF;
  END IF;
  RETURN jsonb_build_object('allowed', true);
END;
$$;

-- ============================================================
-- RLS POLICIES — CLUBS
-- ============================================================
CREATE POLICY "Admins manage clubs" ON public.clubs FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager read clubs" ON public.clubs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "CSE create clubs" ON public.clubs FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND created_by = auth.uid());
CREATE POLICY "CSE update own clubs" ON public.clubs FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND created_by = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND created_by = auth.uid());
CREATE POLICY "CSE delete own clubs" ON public.clubs FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND created_by = auth.uid());
CREATE POLICY "CSE read own clubs" ON public.clubs FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND created_by = auth.uid());
CREATE POLICY "Coordinators read own clubs" ON public.clubs FOR SELECT TO authenticated
  USING (is_club_coordinator(auth.uid(), id));
CREATE POLICY "Coordinators update own clubs" ON public.clubs FOR UPDATE TO authenticated
  USING (is_club_coordinator(auth.uid(), id))
  WITH CHECK (is_club_coordinator(auth.uid(), id));
CREATE POLICY "Authenticated read active clubs" ON public.clubs FOR SELECT TO authenticated
  USING (status = 'active');

-- RLS — CLUB COORDINATORS
CREATE POLICY "Admins manage club coordinators" ON public.club_coordinators FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager read club coordinators" ON public.club_coordinators FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "CSE manage coordinators for own clubs" ON public.club_coordinators FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND is_club_creator(club_id, auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND is_club_creator(club_id, auth.uid()));
CREATE POLICY "Coordinators read club coordinators" ON public.club_coordinators FOR SELECT TO authenticated
  USING (is_club_coordinator(auth.uid(), club_id));
CREATE POLICY "Authenticated read coordinators of active clubs" ON public.club_coordinators FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM clubs c WHERE c.id = club_id AND c.status = 'active'));

-- RLS — CLUB ENROLLMENTS
CREATE POLICY "Admins manage club enrollments" ON public.club_enrollments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager read club enrollments" ON public.club_enrollments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "CSE manage enrollments for own clubs" ON public.club_enrollments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND is_club_creator(club_id, auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND is_club_creator(club_id, auth.uid()));
CREATE POLICY "Coordinators read club enrollments" ON public.club_enrollments FOR SELECT TO authenticated
  USING (is_club_coordinator(auth.uid(), club_id));
CREATE POLICY "Coordinators update club enrollments" ON public.club_enrollments FOR UPDATE TO authenticated
  USING (is_club_coordinator(auth.uid(), club_id))
  WITH CHECK (is_club_coordinator(auth.uid(), club_id));
CREATE POLICY "Students read own enrollments" ON public.club_enrollments FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY "Students enroll self" ON public.club_enrollments FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND has_role(auth.uid(), 'student'::app_role));
CREATE POLICY "Students withdraw own" ON public.club_enrollments FOR UPDATE TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "Homeroom read class enrollments" ON public.club_enrollments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND student_id IN (
    SELECT sca.student_id FROM student_class_assignments sca
    JOIN classes c ON c.id = sca.class_id WHERE c.homeroom_teacher_id = auth.uid()
  ));

-- RLS — CLUB MEETINGS
CREATE POLICY "Admins manage club meetings" ON public.club_meetings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager read club meetings" ON public.club_meetings FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "CSE manage meetings for own clubs" ON public.club_meetings FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND is_club_creator(club_id, auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND is_club_creator(club_id, auth.uid()));
CREATE POLICY "Coordinators manage club meetings" ON public.club_meetings FOR ALL TO authenticated
  USING (is_club_coordinator(auth.uid(), club_id))
  WITH CHECK (is_club_coordinator(auth.uid(), club_id));
CREATE POLICY "Enrolled students read meetings" ON public.club_meetings FOR SELECT TO authenticated
  USING (is_club_enrolled(auth.uid(), club_id));

-- RLS — CLUB ATTENDANCE
CREATE POLICY "Admins manage club attendance" ON public.club_attendance FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager read club attendance" ON public.club_attendance FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "CSE manage attendance for own clubs" ON public.club_attendance FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND is_club_creator(get_club_id_for_meeting(meeting_id), auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND is_club_creator(get_club_id_for_meeting(meeting_id), auth.uid()));
CREATE POLICY "Coordinators manage club attendance" ON public.club_attendance FOR ALL TO authenticated
  USING (is_club_coordinator(auth.uid(), get_club_id_for_meeting(meeting_id)))
  WITH CHECK (is_club_coordinator(auth.uid(), get_club_id_for_meeting(meeting_id)));
CREATE POLICY "Students read own attendance" ON public.club_attendance FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY "Homeroom read class club attendance" ON public.club_attendance FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND student_id IN (
    SELECT sca.student_id FROM student_class_assignments sca
    JOIN classes c ON c.id = sca.class_id WHERE c.homeroom_teacher_id = auth.uid()
  ));

-- ============================================================
-- RLS POLICIES — VOLUNTEER
-- ============================================================
CREATE POLICY "Admins manage volunteer projects" ON public.volunteer_projects FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager read volunteer projects" ON public.volunteer_projects FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "CSE create volunteer projects" ON public.volunteer_projects FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND created_by = auth.uid());
CREATE POLICY "CSE update own projects" ON public.volunteer_projects FOR UPDATE TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND created_by = auth.uid())
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND created_by = auth.uid());
CREATE POLICY "CSE delete own projects" ON public.volunteer_projects FOR DELETE TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND created_by = auth.uid());
CREATE POLICY "CSE read own projects" ON public.volunteer_projects FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND created_by = auth.uid());
CREATE POLICY "Coordinators read own projects" ON public.volunteer_projects FOR SELECT TO authenticated
  USING (is_volunteer_coordinator(auth.uid(), id));
CREATE POLICY "Coordinators update own projects" ON public.volunteer_projects FOR UPDATE TO authenticated
  USING (is_volunteer_coordinator(auth.uid(), id))
  WITH CHECK (is_volunteer_coordinator(auth.uid(), id));
CREATE POLICY "Authenticated read active projects" ON public.volunteer_projects FOR SELECT TO authenticated
  USING (status = 'active');

-- RLS — VOLUNTEER COORDINATORS
CREATE POLICY "Admins manage volunteer coordinators" ON public.volunteer_coordinators FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager read volunteer coordinators" ON public.volunteer_coordinators FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "CSE manage coordinators for own projects" ON public.volunteer_coordinators FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND is_volunteer_creator(project_id, auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND is_volunteer_creator(project_id, auth.uid()));
CREATE POLICY "Coordinators read volunteer coordinators" ON public.volunteer_coordinators FOR SELECT TO authenticated
  USING (is_volunteer_coordinator(auth.uid(), project_id));
CREATE POLICY "Authenticated read coordinators of active projects" ON public.volunteer_coordinators FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM volunteer_projects p WHERE p.id = project_id AND p.status = 'active'));

-- RLS — VOLUNTEER ENROLLMENTS
CREATE POLICY "Admins manage volunteer enrollments" ON public.volunteer_enrollments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager read volunteer enrollments" ON public.volunteer_enrollments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "CSE manage enrollments for own projects" ON public.volunteer_enrollments FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND is_volunteer_creator(project_id, auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND is_volunteer_creator(project_id, auth.uid()));
CREATE POLICY "Coordinators read volunteer enrollments" ON public.volunteer_enrollments FOR SELECT TO authenticated
  USING (is_volunteer_coordinator(auth.uid(), project_id));
CREATE POLICY "Coordinators update volunteer enrollments" ON public.volunteer_enrollments FOR UPDATE TO authenticated
  USING (is_volunteer_coordinator(auth.uid(), project_id))
  WITH CHECK (is_volunteer_coordinator(auth.uid(), project_id));
CREATE POLICY "Students read own volunteer enrollments" ON public.volunteer_enrollments FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY "Students enroll self volunteer" ON public.volunteer_enrollments FOR INSERT TO authenticated
  WITH CHECK (student_id = auth.uid() AND has_role(auth.uid(), 'student'::app_role));
CREATE POLICY "Students withdraw own volunteer" ON public.volunteer_enrollments FOR UPDATE TO authenticated
  USING (student_id = auth.uid()) WITH CHECK (student_id = auth.uid());
CREATE POLICY "Homeroom read class volunteer enrollments" ON public.volunteer_enrollments FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND student_id IN (
    SELECT sca.student_id FROM student_class_assignments sca
    JOIN classes c ON c.id = sca.class_id WHERE c.homeroom_teacher_id = auth.uid()
  ));

-- RLS — VOLUNTEER DAYS
CREATE POLICY "Admins manage volunteer days" ON public.volunteer_days FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager read volunteer days" ON public.volunteer_days FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "CSE manage days for own projects" ON public.volunteer_days FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND is_volunteer_creator(project_id, auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND is_volunteer_creator(project_id, auth.uid()));
CREATE POLICY "Coordinators manage volunteer days" ON public.volunteer_days FOR ALL TO authenticated
  USING (is_volunteer_coordinator(auth.uid(), project_id))
  WITH CHECK (is_volunteer_coordinator(auth.uid(), project_id));
CREATE POLICY "Enrolled students read volunteer days" ON public.volunteer_days FOR SELECT TO authenticated
  USING (is_volunteer_enrolled(auth.uid(), project_id));

-- RLS — VOLUNTEER ATTENDANCE
CREATE POLICY "Admins manage volunteer attendance" ON public.volunteer_attendance FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'admin'::app_role)) WITH CHECK (has_role(auth.uid(), 'admin'::app_role));
CREATE POLICY "Manager read volunteer attendance" ON public.volunteer_attendance FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'manager'::app_role));
CREATE POLICY "CSE manage attendance for own projects" ON public.volunteer_attendance FOR ALL TO authenticated
  USING (has_role(auth.uid(), 'cse'::app_role) AND is_volunteer_creator(get_project_id_for_day(day_id), auth.uid()))
  WITH CHECK (has_role(auth.uid(), 'cse'::app_role) AND is_volunteer_creator(get_project_id_for_day(day_id), auth.uid()));
CREATE POLICY "Coordinators manage volunteer attendance" ON public.volunteer_attendance FOR ALL TO authenticated
  USING (is_volunteer_coordinator(auth.uid(), get_project_id_for_day(day_id)))
  WITH CHECK (is_volunteer_coordinator(auth.uid(), get_project_id_for_day(day_id)));
CREATE POLICY "Students read own volunteer attendance" ON public.volunteer_attendance FOR SELECT TO authenticated
  USING (student_id = auth.uid());
CREATE POLICY "Homeroom read class volunteer attendance" ON public.volunteer_attendance FOR SELECT TO authenticated
  USING (has_role(auth.uid(), 'homeroom_teacher'::app_role) AND student_id IN (
    SELECT sca.student_id FROM student_class_assignments sca
    JOIN classes c ON c.id = sca.class_id WHERE c.homeroom_teacher_id = auth.uid()
  ));
