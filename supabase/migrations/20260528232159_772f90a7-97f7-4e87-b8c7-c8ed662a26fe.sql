
-- 1. Add is_private column on volunteer_projects
ALTER TABLE public.volunteer_projects
  ADD COLUMN IF NOT EXISTS is_private boolean NOT NULL DEFAULT false;

-- 2. Update visibility of volunteer_projects to hide private from non-enrolled students
DROP POLICY IF EXISTS "Authenticated read active projects" ON public.volunteer_projects;
CREATE POLICY "Authenticated read active public projects"
  ON public.volunteer_projects FOR SELECT
  USING (status = 'active'::volunteer_project_status AND is_private = false);

CREATE POLICY "Enrolled read volunteer project"
  ON public.volunteer_projects FOR SELECT
  USING (public.is_volunteer_enrolled(auth.uid(), id));

-- 3. Block self-enroll on private projects (check function + RLS)
CREATE OR REPLACE FUNCTION public.check_volunteer_enrollment(_student_id uuid, _project_id uuid)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
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
  IF _p.is_private THEN
    RETURN jsonb_build_object('allowed', false, 'reason', 'Acest proiect este privat - participanții sunt aleși de organizator');
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
$function$;

-- 4. Add Teacher / Homeroom creator policies on clubs
CREATE POLICY "Teachers create clubs" ON public.clubs FOR INSERT
  WITH CHECK ((public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'homeroom_teacher'::app_role)) AND created_by = auth.uid());
CREATE POLICY "Teachers read own clubs" ON public.clubs FOR SELECT
  USING ((public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'homeroom_teacher'::app_role)) AND created_by = auth.uid());
CREATE POLICY "Teachers update own clubs" ON public.clubs FOR UPDATE
  USING ((public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'homeroom_teacher'::app_role)) AND created_by = auth.uid())
  WITH CHECK ((public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'homeroom_teacher'::app_role)) AND created_by = auth.uid());
CREATE POLICY "Teachers delete own clubs" ON public.clubs FOR DELETE
  USING ((public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'homeroom_teacher'::app_role)) AND created_by = auth.uid());

-- 5. Add Teacher / Homeroom creator policies on volunteer_projects
CREATE POLICY "Teachers create volunteer projects" ON public.volunteer_projects FOR INSERT
  WITH CHECK ((public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'homeroom_teacher'::app_role)) AND created_by = auth.uid());
CREATE POLICY "Teachers read own volunteer projects" ON public.volunteer_projects FOR SELECT
  USING ((public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'homeroom_teacher'::app_role)) AND created_by = auth.uid());
CREATE POLICY "Teachers update own volunteer projects" ON public.volunteer_projects FOR UPDATE
  USING ((public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'homeroom_teacher'::app_role)) AND created_by = auth.uid())
  WITH CHECK ((public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'homeroom_teacher'::app_role)) AND created_by = auth.uid());
CREATE POLICY "Teachers delete own volunteer projects" ON public.volunteer_projects FOR DELETE
  USING ((public.has_role(auth.uid(), 'teacher'::app_role) OR public.has_role(auth.uid(), 'homeroom_teacher'::app_role)) AND created_by = auth.uid());

-- 6. Manage enrollments / coordinators / days / meetings / attendance for teacher creators
CREATE POLICY "Teachers manage club enrollments for own clubs"
  ON public.club_enrollments FOR ALL
  USING ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_club_creator(club_id, auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_club_creator(club_id, auth.uid()));

CREATE POLICY "Teachers manage club coordinators for own clubs"
  ON public.club_coordinators FOR ALL
  USING ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_club_creator(club_id, auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_club_creator(club_id, auth.uid()));

CREATE POLICY "Teachers manage meetings for own clubs"
  ON public.club_meetings FOR ALL
  USING ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_club_creator(club_id, auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_club_creator(club_id, auth.uid()));

CREATE POLICY "Teachers manage club attendance for own clubs"
  ON public.club_attendance FOR ALL
  USING ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_club_creator(public.get_club_id_for_meeting(meeting_id), auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_club_creator(public.get_club_id_for_meeting(meeting_id), auth.uid()));

CREATE POLICY "Teachers manage enrollments for own volunteer projects"
  ON public.volunteer_enrollments FOR ALL
  USING ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_volunteer_creator(project_id, auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_volunteer_creator(project_id, auth.uid()));

CREATE POLICY "Teachers manage volunteer coordinators for own projects"
  ON public.volunteer_coordinators FOR ALL
  USING ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_volunteer_creator(project_id, auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_volunteer_creator(project_id, auth.uid()));

CREATE POLICY "Teachers manage volunteer days for own projects"
  ON public.volunteer_days FOR ALL
  USING ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_volunteer_creator(project_id, auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_volunteer_creator(project_id, auth.uid()));

CREATE POLICY "Teachers manage volunteer attendance for own projects"
  ON public.volunteer_attendance FOR ALL
  USING ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_volunteer_creator(public.get_project_id_for_day(day_id), auth.uid()))
  WITH CHECK ((public.has_role(auth.uid(),'teacher'::app_role) OR public.has_role(auth.uid(),'homeroom_teacher'::app_role)) AND public.is_volunteer_creator(public.get_project_id_for_day(day_id), auth.uid()));
