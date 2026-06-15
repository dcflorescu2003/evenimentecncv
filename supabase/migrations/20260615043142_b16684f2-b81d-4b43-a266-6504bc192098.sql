
-- =========================================
-- portfolio_involvement
-- =========================================
CREATE TYPE public.portfolio_involvement_type AS ENUM (
  'voluntariat','ajutor','proiect','eveniment','sprijin','club','materiale'
);

CREATE TYPE public.portfolio_involvement_status AS ENUM (
  'pending','approved','rejected'
);

CREATE TABLE public.portfolio_involvement (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  type public.portfolio_involvement_type NOT NULL,
  description text NOT NULL,
  hours numeric(5,2),
  occurred_on date,
  status public.portfolio_involvement_status NOT NULL DEFAULT 'pending',
  teacher_note text,
  attach_to_portfolio boolean NOT NULL DEFAULT false,
  academic_year text,
  created_by uuid NOT NULL,
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_portfolio_involvement_student ON public.portfolio_involvement(student_id);
CREATE INDEX idx_portfolio_involvement_teacher ON public.portfolio_involvement(teacher_id);
CREATE INDEX idx_portfolio_involvement_status ON public.portfolio_involvement(status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_involvement TO authenticated;
GRANT ALL ON public.portfolio_involvement TO service_role;

ALTER TABLE public.portfolio_involvement ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all involvement"
  ON public.portfolio_involvement FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teacher manages own students involvement"
  ON public.portfolio_involvement FOR ALL TO authenticated
  USING (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'))
  WITH CHECK (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'));

CREATE POLICY "Student views own involvement"
  ON public.portfolio_involvement FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Student inserts own pending involvement"
  ON public.portfolio_involvement FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND created_by = auth.uid()
    AND status = 'pending'
  );

CREATE POLICY "Student deletes own pending involvement"
  ON public.portfolio_involvement FOR DELETE TO authenticated
  USING (student_id = auth.uid() AND status = 'pending');

CREATE TRIGGER update_portfolio_involvement_updated_at
  BEFORE UPDATE ON public.portfolio_involvement
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-attach to portfolio on approval
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
      student_id, teacher_id, title, type, source, source_id,
      visible_to_student, academic_year, description
    ) VALUES (
      NEW.student_id,
      NEW.teacher_id,
      'Implicare: ' || NEW.type::text,
      'voluntariat',
      'involvement',
      NEW.id,
      true,
      NEW.academic_year,
      NEW.description
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_portfolio_involvement_attach
  AFTER INSERT OR UPDATE OF status ON public.portfolio_involvement
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_involvement_attach();

-- =========================================
-- portfolio_board_picks
-- =========================================
CREATE TYPE public.portfolio_board_pick_mode AS ENUM (
  'random','balanced','no_repeat','no_absent','no_today','manual'
);

CREATE TABLE public.portfolio_board_picks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  class_id uuid NOT NULL REFERENCES public.classes(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  picked_on date NOT NULL DEFAULT CURRENT_DATE,
  lesson text,
  mode public.portfolio_board_pick_mode NOT NULL DEFAULT 'random',
  score numeric(4,2),
  note text,
  attach_to_portfolio boolean NOT NULL DEFAULT false,
  academic_year text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_portfolio_board_picks_teacher ON public.portfolio_board_picks(teacher_id);
CREATE INDEX idx_portfolio_board_picks_class ON public.portfolio_board_picks(class_id);
CREATE INDEX idx_portfolio_board_picks_student ON public.portfolio_board_picks(student_id);
CREATE INDEX idx_portfolio_board_picks_date ON public.portfolio_board_picks(picked_on);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_board_picks TO authenticated;
GRANT ALL ON public.portfolio_board_picks TO service_role;

ALTER TABLE public.portfolio_board_picks ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admins manage all board picks"
  ON public.portfolio_board_picks FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Teacher manages own board picks"
  ON public.portfolio_board_picks FOR ALL TO authenticated
  USING (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'))
  WITH CHECK (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'));

CREATE POLICY "Student views own board picks"
  ON public.portfolio_board_picks FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE TRIGGER update_portfolio_board_picks_updated_at
  BEFORE UPDATE ON public.portfolio_board_picks
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-attach to portfolio on insert/update if requested
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
      student_id, teacher_id, title, type, source, source_id,
      visible_to_student, academic_year, description
    ) VALUES (
      NEW.student_id,
      NEW.teacher_id,
      COALESCE('Răspuns la tablă: ' || NEW.lesson, 'Răspuns la tablă'),
      'observatie',
      'board_pick',
      NEW.id,
      true,
      NEW.academic_year,
      CASE
        WHEN NEW.score IS NOT NULL THEN 'Punctaj: ' || NEW.score::text || COALESCE(' — ' || NEW.note, '')
        ELSE NEW.note
      END
    )
    ON CONFLICT DO NOTHING;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_portfolio_board_pick_attach
  AFTER INSERT OR UPDATE OF attach_to_portfolio ON public.portfolio_board_picks
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_board_pick_attach();
