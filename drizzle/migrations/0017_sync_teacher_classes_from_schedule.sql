CREATE OR REPLACE FUNCTION public.sync_teacher_classes_from_schedule()
RETURNS integer LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE n integer;
BEGIN
  IF auth.uid() IS NOT NULL AND NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Doar adminul poate sincroniza clasele profesorilor';
  END IF;
  CREATE TEMP TABLE _sched ON COMMIT DROP AS
    SELECT DISTINCT t.tid AS teacher_id, c.id AS class_id, c.academic_year
    FROM schedule_entries se
    JOIN class_schedules cs ON cs.id = se.schedule_id
    JOIN classes c ON c.id = cs.class_id AND c.is_active
    CROSS JOIN LATERAL unnest(se.teacher_ids) AS t(tid)
    JOIN profiles p ON p.id = t.tid;
  DELETE FROM portfolio_teacher_classes ptc
   WHERE ptc.teacher_id IN (SELECT teacher_id FROM _sched)
     AND NOT EXISTS (SELECT 1 FROM _sched s WHERE s.teacher_id = ptc.teacher_id AND s.class_id = ptc.class_id);
  INSERT INTO portfolio_teacher_classes (teacher_id, class_id, academic_year)
  SELECT s.teacher_id, s.class_id, s.academic_year FROM _sched s
   WHERE NOT EXISTS (SELECT 1 FROM portfolio_teacher_classes x WHERE x.teacher_id = s.teacher_id AND x.class_id = s.class_id);
  GET DIAGNOSTICS n = ROW_COUNT;
  RETURN n;
END $$;
REVOKE ALL ON FUNCTION public.sync_teacher_classes_from_schedule() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.sync_teacher_classes_from_schedule() TO authenticated, service_role;

-- Backfill: LF2 (LIBER FIZ2) = Emanuel Nicolae Coca
UPDATE public.profiles SET initials = 'LF2' WHERE id = '2f974352-4016-473e-87d4-219a38244dca';
UPDATE public.schedule_entries SET teacher_ids = ARRAY['2f974352-4016-473e-87d4-219a38244dca']::uuid[]
 WHERE teacher_name = 'LF2';
SELECT public.sync_teacher_classes_from_schedule();