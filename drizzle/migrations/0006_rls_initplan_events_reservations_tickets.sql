DO $$
DECLARE p record; q text; w text; sql text;
BEGIN
  FOR p IN SELECT tablename, policyname, qual, with_check FROM pg_policies
           WHERE schemaname='public' AND tablename IN ('events','reservations','tickets') LOOP
    q := p.qual; w := p.with_check;
    IF q IS NOT NULL THEN
      q := regexp_replace(q, 'has_role\(auth\.uid\(\), ''(\w+)''::app_role\)', '@@HR\1@@', 'g');
      q := replace(q, 'auth.uid()', '(SELECT auth.uid())');
      q := regexp_replace(q, '@@HR(\w+)@@', '(SELECT has_role(auth.uid(), ''\1''::app_role))', 'g');
    END IF;
    IF w IS NOT NULL THEN
      w := regexp_replace(w, 'has_role\(auth\.uid\(\), ''(\w+)''::app_role\)', '@@HR\1@@', 'g');
      w := replace(w, 'auth.uid()', '(SELECT auth.uid())');
      w := regexp_replace(w, '@@HR(\w+)@@', '(SELECT has_role(auth.uid(), ''\1''::app_role))', 'g');
    END IF;
    sql := format('ALTER POLICY %I ON public.%I', p.policyname, p.tablename);
    IF q IS NOT NULL THEN sql := sql || ' USING (' || q || ')'; END IF;
    IF w IS NOT NULL THEN sql := sql || ' WITH CHECK (' || w || ')'; END IF;
    IF q IS NOT NULL OR w IS NOT NULL THEN EXECUTE sql; END IF;
  END LOOP;
END $$;

CREATE INDEX IF NOT EXISTS idx_reservations_student_event ON public.reservations(student_id, event_id);
CREATE INDEX IF NOT EXISTS idx_reservations_event ON public.reservations(event_id);
CREATE INDEX IF NOT EXISTS idx_coord_assign_teacher_event ON public.coordinator_assignments(teacher_id, event_id);
CREATE INDEX IF NOT EXISTS idx_esa_student_event ON public.event_student_assistants(student_id, event_id);
CREATE INDEX IF NOT EXISTS idx_sca_student ON public.student_class_assignments(student_id);
CREATE INDEX IF NOT EXISTS idx_sca_class ON public.student_class_assignments(class_id);
CREATE INDEX IF NOT EXISTS idx_classes_homeroom ON public.classes(homeroom_teacher_id);
CREATE INDEX IF NOT EXISTS idx_user_roles_user_role ON public.user_roles(user_id, role);