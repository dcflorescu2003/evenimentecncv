-- ============ 1. can_manage_club: fără asistenți ============
CREATE OR REPLACE FUNCTION public.can_manage_club(_user_id uuid, _club_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT public.has_role(_user_id, 'admin')
      OR public.is_club_coordinator(_user_id, _club_id)
      OR public.is_club_creator(_club_id, _user_id)
$$;

-- ============ 2. Asistenți club: doar citire + prezență ============
DROP POLICY IF EXISTS "Assistants manage club enrollments" ON public.club_enrollments;
CREATE POLICY "Assistants read club enrollments" ON public.club_enrollments
  FOR SELECT TO authenticated
  USING (public.is_club_student_assistant(auth.uid(), club_id));

DROP POLICY IF EXISTS "Assistants manage club meetings" ON public.club_meetings;
CREATE POLICY "Assistants read club meetings" ON public.club_meetings
  FOR SELECT TO authenticated
  USING (public.is_club_student_assistant(auth.uid(), club_id));

CREATE POLICY "Assistants read enrollment answers" ON public.club_enrollment_answers
  FOR SELECT TO authenticated
  USING (public.is_club_student_assistant(auth.uid(), public.get_club_id_for_enrollment(enrollment_id)));

CREATE POLICY "Assistants read club departments" ON public.club_departments
  FOR SELECT TO authenticated
  USING (public.is_club_student_assistant(auth.uid(), club_id));

-- ============ 3. Asistenți elevi la voluntariat ============
CREATE TABLE public.volunteer_student_assistants (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id uuid NOT NULL REFERENCES public.volunteer_projects(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  assigned_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (project_id, student_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.volunteer_student_assistants TO authenticated;
GRANT ALL ON public.volunteer_student_assistants TO service_role;
ALTER TABLE public.volunteer_student_assistants ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.is_volunteer_student_assistant(_user_id uuid, _project_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.volunteer_student_assistants
    WHERE project_id = _project_id AND student_id = _user_id
  )
$$;
REVOKE EXECUTE ON FUNCTION public.is_volunteer_student_assistant(uuid, uuid) FROM anon;

CREATE POLICY "Admins manage volunteer assistants" ON public.volunteer_student_assistants
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));
CREATE POLICY "Owners manage volunteer assistants" ON public.volunteer_student_assistants
  FOR ALL TO authenticated
  USING (public.is_volunteer_creator(project_id, auth.uid()) OR public.is_volunteer_coordinator(auth.uid(), project_id))
  WITH CHECK (public.is_volunteer_creator(project_id, auth.uid()) OR public.is_volunteer_coordinator(auth.uid(), project_id));
CREATE POLICY "Assistants read own volunteer assignment" ON public.volunteer_student_assistants
  FOR SELECT TO authenticated USING (student_id = auth.uid());
CREATE POLICY "Manager read volunteer assistants" ON public.volunteer_student_assistants
  FOR SELECT TO authenticated USING (public.has_role(auth.uid(), 'manager'));

CREATE POLICY "Assistants read volunteer project" ON public.volunteer_projects
  FOR SELECT TO authenticated USING (public.is_volunteer_student_assistant(auth.uid(), id));
CREATE POLICY "Assistants read volunteer enrollments" ON public.volunteer_enrollments
  FOR SELECT TO authenticated USING (public.is_volunteer_student_assistant(auth.uid(), project_id));
CREATE POLICY "Assistants read volunteer days" ON public.volunteer_days
  FOR SELECT TO authenticated USING (public.is_volunteer_student_assistant(auth.uid(), project_id));
CREATE POLICY "Assistants manage volunteer attendance" ON public.volunteer_attendance
  FOR ALL TO authenticated
  USING (public.is_volunteer_student_assistant(auth.uid(), public.get_project_id_for_day(day_id)))
  WITH CHECK (public.is_volunteer_student_assistant(auth.uid(), public.get_project_id_for_day(day_id)));
CREATE POLICY "Assistants read volunteer coordinators" ON public.volunteer_coordinators
  FOR SELECT TO authenticated USING (public.is_volunteer_student_assistant(auth.uid(), project_id));

-- ============ 4. Coordonatorii pot gestiona coordonatori/asistenți ============
CREATE POLICY "Coordinators manage club coordinators" ON public.club_coordinators
  FOR ALL TO authenticated
  USING (public.is_club_coordinator(auth.uid(), club_id))
  WITH CHECK (public.is_club_coordinator(auth.uid(), club_id));
CREATE POLICY "Coordinators manage volunteer coordinators" ON public.volunteer_coordinators
  FOR ALL TO authenticated
  USING (public.is_volunteer_coordinator(auth.uid(), project_id))
  WITH CHECK (public.is_volunteer_coordinator(auth.uid(), project_id));

-- ============ 5. Maxim 2 elevi coordonatori ============
CREATE OR REPLACE FUNCTION public.enforce_student_coordinator_limit()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public
AS $$
DECLARE
  v_count integer;
BEGIN
  IF NOT public.has_role(NEW.user_id, 'student') THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'club_coordinators' THEN
    SELECT count(*) INTO v_count
    FROM public.club_coordinators cc
    WHERE cc.club_id = NEW.club_id
      AND cc.id <> NEW.id
      AND public.has_role(cc.user_id, 'student');
  ELSE
    SELECT count(*) INTO v_count
    FROM public.volunteer_coordinators vc
    WHERE vc.project_id = NEW.project_id
      AND vc.id <> NEW.id
      AND public.has_role(vc.user_id, 'student');
  END IF;

  IF v_count >= 2 THEN
    RAISE EXCEPTION 'Poți avea maxim 2 elevi coordonatori.';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER club_coordinators_student_limit
  BEFORE INSERT OR UPDATE ON public.club_coordinators
  FOR EACH ROW EXECUTE FUNCTION public.enforce_student_coordinator_limit();

CREATE TRIGGER volunteer_coordinators_student_limit
  BEFORE INSERT OR UPDATE ON public.volunteer_coordinators
  FOR EACH ROW EXECUTE FUNCTION public.enforce_student_coordinator_limit();