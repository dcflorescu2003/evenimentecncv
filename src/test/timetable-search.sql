-- Run with psql; all temporary role changes are rolled back.
BEGIN;
DO $$
DECLARE uid uuid; sample text; n integer; role_name text;
BEGIN
 SELECT p.last_name INTO sample FROM public.profiles p
 JOIN public.student_class_assignments a ON a.student_id=p.id
 JOIN public.classes c ON c.id=a.class_id AND c.is_active AND c.academic_year=a.academic_year
 WHERE p.is_active AND length(p.last_name)>=2
 AND EXISTS (SELECT 1 FROM public.user_roles r WHERE r.user_id=p.id AND r.role='student') LIMIT 1;
 IF sample IS NULL THEN RAISE EXCEPTION 'Test requires an active student'; END IF;
 FOREACH role_name IN ARRAY ARRAY['admin','teacher','homeroom_teacher'] LOOP
  SELECT r.user_id INTO uid FROM public.user_roles r WHERE r.role::text=role_name
   AND NOT public.has_role(r.user_id,'cse') LIMIT 1;
  IF uid IS NULL THEN RAISE EXCEPTION 'Test requires role %',role_name; END IF;
  PERFORM set_config('request.jwt.claim.sub',uid::text,true);
  SELECT count(*) INTO n FROM public.search_students_for_timetable(sample,50);
  IF n<1 THEN RAISE EXCEPTION 'Role % must find active student and class',role_name; END IF;
  SELECT count(*) INTO n FROM public.search_students_for_timetable('a',50);
  IF n<>0 THEN RAISE EXCEPTION 'One character must not search'; END IF;
 END LOOP;
 SELECT user_id INTO uid FROM public.user_roles WHERE role='student' LIMIT 1;
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 BEGIN
  PERFORM * FROM public.search_students_for_timetable(sample,50);
  RAISE EXCEPTION 'Student search should be denied';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 SELECT user_id INTO uid FROM public.user_roles WHERE role='teacher' LIMIT 1;
 INSERT INTO public.user_roles(user_id,role) VALUES(uid,'cse') ON CONFLICT(user_id,role) DO NOTHING;
 PERFORM set_config('request.jwt.claim.sub',uid::text,true);
 BEGIN
  PERFORM * FROM public.search_students_for_timetable(sample,50);
  RAISE EXCEPTION 'CSE with teacher role should be denied';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
 PERFORM set_config('request.jwt.claim.sub','',true);
 BEGIN
  PERFORM * FROM public.search_students_for_timetable(sample,50);
  RAISE EXCEPTION 'Signed out search should be denied';
 EXCEPTION WHEN insufficient_privilege THEN NULL; END;
END;
$$;
ROLLBACK;