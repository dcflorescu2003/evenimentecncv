DROP POLICY IF EXISTS "Teachers read teacher profiles" ON public.profiles;
CREATE POLICY "Teachers read teacher profiles" ON public.profiles FOR SELECT TO authenticated
USING ((has_role(auth.uid(),'teacher') OR has_role(auth.uid(),'cse')) AND id IN (SELECT ur.user_id FROM public.user_roles ur WHERE ur.role IN ('teacher','coordinator_teacher','homeroom_teacher','cse')));

CREATE OR REPLACE FUNCTION public.validate_event_assistant_enrolled()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM reservations WHERE event_id = NEW.event_id AND student_id = NEW.student_id AND status <> 'cancelled') THEN
    RAISE EXCEPTION 'Elevul trebuie să fie înscris la eveniment ca să fie asistent';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_validate_event_assistant_enrolled ON public.event_student_assistants;
CREATE TRIGGER trg_validate_event_assistant_enrolled BEFORE INSERT ON public.event_student_assistants
FOR EACH ROW EXECUTE FUNCTION public.validate_event_assistant_enrolled();