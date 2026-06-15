
-- =========================================================
-- Portfolio Stage 4: Competitions
-- =========================================================

CREATE TABLE public.portfolio_competitions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'scolar', -- scolar/judetean/national/international/online/altul
  difficulty text NOT NULL DEFAULT 'mediu', -- usor/mediu/greu
  class_ids uuid[] NOT NULL DEFAULT '{}',
  signup_deadline date,
  event_date date,
  regulation_url text,
  location text,
  seats integer,
  team_mode text NOT NULL DEFAULT 'individual', -- individual/echipa
  status text NOT NULL DEFAULT 'active', -- active/closed/archived
  academic_year text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_competitions TO authenticated;
GRANT ALL ON public.portfolio_competitions TO service_role;

ALTER TABLE public.portfolio_competitions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages all competitions"
  ON public.portfolio_competitions FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teacher manages own competitions"
  ON public.portfolio_competitions FOR ALL TO authenticated
  USING (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'))
  WITH CHECK (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'));

CREATE POLICY "Students read competitions for their class"
  ON public.portfolio_competitions FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.student_class_assignments sca
      WHERE sca.student_id = auth.uid()
        AND sca.class_id = ANY (portfolio_competitions.class_ids)
    )
  );

CREATE INDEX idx_pc_teacher ON public.portfolio_competitions(teacher_id);
CREATE INDEX idx_pc_classes ON public.portfolio_competitions USING gin(class_ids);

CREATE TRIGGER trg_pc_updated
  BEFORE UPDATE ON public.portfolio_competitions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================

CREATE TABLE public.portfolio_competition_signups (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  competition_id uuid NOT NULL REFERENCES public.portfolio_competitions(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'interested', -- interested/selected/registered/participated
  result text, -- text liber: ex "Locul I", "Mențiune", "Calificat etapa județeană"
  award text, -- premiu I/II/III/mențiune/participare/niciunul
  score numeric,
  notes text,
  diploma_path text,
  diploma_name text,
  project_path text,
  project_name text,
  attach_to_portfolio boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (competition_id, student_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_competition_signups TO authenticated;
GRANT ALL ON public.portfolio_competition_signups TO service_role;

ALTER TABLE public.portfolio_competition_signups ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages all signups"
  ON public.portfolio_competition_signups FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teacher manages signups for own competitions"
  ON public.portfolio_competition_signups FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.portfolio_competitions pc
      WHERE pc.id = competition_id
        AND pc.teacher_id = auth.uid()
        AND public.has_module_access(auth.uid(), 'portfolio')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.portfolio_competitions pc
      WHERE pc.id = competition_id
        AND pc.teacher_id = auth.uid()
        AND public.has_module_access(auth.uid(), 'portfolio')
    )
  );

CREATE POLICY "Students read own signups"
  ON public.portfolio_competition_signups FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE POLICY "Students express interest"
  ON public.portfolio_competition_signups FOR INSERT TO authenticated
  WITH CHECK (
    student_id = auth.uid()
    AND status = 'interested'
    AND EXISTS (
      SELECT 1 FROM public.portfolio_competitions pc
      WHERE pc.id = competition_id
        AND EXISTS (
          SELECT 1 FROM public.student_class_assignments sca
          WHERE sca.student_id = auth.uid()
            AND sca.class_id = ANY (pc.class_ids)
        )
    )
  );

CREATE POLICY "Students withdraw own interest"
  ON public.portfolio_competition_signups FOR DELETE TO authenticated
  USING (student_id = auth.uid() AND status = 'interested');

CREATE INDEX idx_pcs_competition ON public.portfolio_competition_signups(competition_id);
CREATE INDEX idx_pcs_student ON public.portfolio_competition_signups(student_id);

CREATE TRIGGER trg_pcs_updated
  BEFORE UPDATE ON public.portfolio_competition_signups
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- =========================================================
-- Trigger: auto-add to student portfolio when diploma/award is set
-- =========================================================

CREATE OR REPLACE FUNCTION public.portfolio_competition_signup_to_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_teacher_id uuid;
  v_title text;
  v_academic_year text;
BEGIN
  IF NEW.attach_to_portfolio = false THEN
    RETURN NEW;
  END IF;

  -- Trigger when we have diploma OR an award/result set, only when these change
  IF (NEW.diploma_path IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.diploma_path IS DISTINCT FROM OLD.diploma_path))
     OR (NEW.award IS NOT NULL AND NEW.award <> '' AND (TG_OP = 'INSERT' OR NEW.award IS DISTINCT FROM COALESCE(OLD.award, ''))) THEN

    SELECT pc.teacher_id, pc.title, pc.academic_year
      INTO v_teacher_id, v_title, v_academic_year
    FROM public.portfolio_competitions pc
    WHERE pc.id = NEW.competition_id;

    -- Avoid duplicates: one item per signup
    IF NOT EXISTS (
      SELECT 1 FROM public.portfolio_items
      WHERE source = 'competition' AND source_id = NEW.id
    ) THEN
      INSERT INTO public.portfolio_items (
        student_id, teacher_id, title, description, source, source_id,
        file_path, file_name, academic_year, visible_to_student
      ) VALUES (
        NEW.student_id,
        v_teacher_id,
        'Concurs: ' || v_title || COALESCE(' — ' || NEW.award, ''),
        COALESCE(NEW.result, NEW.notes),
        'competition',
        NEW.id,
        NEW.diploma_path,
        NEW.diploma_name,
        v_academic_year,
        true
      );
    ELSE
      UPDATE public.portfolio_items
        SET title = 'Concurs: ' || v_title || COALESCE(' — ' || NEW.award, ''),
            description = COALESCE(NEW.result, NEW.notes),
            file_path = COALESCE(NEW.diploma_path, file_path),
            file_name = COALESCE(NEW.diploma_name, file_name),
            updated_at = now()
      WHERE source = 'competition' AND source_id = NEW.id;
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_pcs_to_item
  AFTER INSERT OR UPDATE ON public.portfolio_competition_signups
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_competition_signup_to_item();
