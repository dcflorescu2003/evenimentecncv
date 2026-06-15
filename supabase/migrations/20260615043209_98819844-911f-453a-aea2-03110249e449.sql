
ALTER TABLE public.portfolio_items DROP CONSTRAINT IF EXISTS portfolio_items_source_check;
ALTER TABLE public.portfolio_items
  ADD CONSTRAINT portfolio_items_source_check
  CHECK (source = ANY (ARRAY['manual'::text,'submission'::text,'competition'::text,'diploma'::text,'involvement'::text,'board_pick'::text]));

CREATE OR REPLACE FUNCTION public.portfolio_involvement_attach()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.status = 'approved'
     AND COALESCE(OLD.status, 'pending'::public.portfolio_involvement_status) <> 'approved'
     AND NEW.attach_to_portfolio = true THEN
    INSERT INTO public.portfolio_items (
      student_id, teacher_id, title, source, source_id,
      visible_to_student, academic_year, description
    ) VALUES (
      NEW.student_id,
      NEW.teacher_id,
      'Implicare: ' || NEW.type::text,
      'involvement',
      NEW.id,
      true,
      NEW.academic_year,
      NEW.description
    );
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.portfolio_board_pick_attach()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.attach_to_portfolio = true
     AND (TG_OP = 'INSERT' OR COALESCE(OLD.attach_to_portfolio, false) = false) THEN
    INSERT INTO public.portfolio_items (
      student_id, teacher_id, title, source, source_id,
      visible_to_student, academic_year, description
    ) VALUES (
      NEW.student_id,
      NEW.teacher_id,
      COALESCE('Răspuns la tablă: ' || NEW.lesson, 'Răspuns la tablă'),
      'board_pick',
      NEW.id,
      true,
      NEW.academic_year,
      CASE
        WHEN NEW.score IS NOT NULL THEN 'Punctaj: ' || NEW.score::text || COALESCE(' — ' || NEW.note, '')
        ELSE NEW.note
      END
    );
  END IF;
  RETURN NEW;
END;
$$;
