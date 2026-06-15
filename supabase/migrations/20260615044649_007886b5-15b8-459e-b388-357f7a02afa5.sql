
-- =========================================================
-- Portfolio Stage 5: Documents / Journal / Teacher items / Student diplomas
-- =========================================================

-- portfolio_documents -------------------------------------------------
CREATE TABLE public.portfolio_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title text NOT NULL,
  category text NOT NULL DEFAULT 'altele',
  -- planificari, programe, fise_evaluare, fise_lucru, teste, regulamente,
  -- procese_verbale, rapoarte, fise_observatie, planuri_lectie,
  -- dosare_concurs, fise_postare, altele
  description text,
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  academic_year text,
  deadline date,
  status text NOT NULL DEFAULT 'in_progress', -- in_progress / done / archived
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_documents TO authenticated;
GRANT ALL ON public.portfolio_documents TO service_role;

ALTER TABLE public.portfolio_documents ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages all documents"
  ON public.portfolio_documents FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teacher manages own documents"
  ON public.portfolio_documents FOR ALL TO authenticated
  USING (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'))
  WITH CHECK (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'));

CREATE INDEX idx_pd_teacher ON public.portfolio_documents(teacher_id);
CREATE INDEX idx_pd_class ON public.portfolio_documents(class_id);

CREATE TRIGGER trg_pd_updated
  BEFORE UPDATE ON public.portfolio_documents
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- portfolio_journal ---------------------------------------------------
CREATE TABLE public.portfolio_journal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  date date NOT NULL DEFAULT CURRENT_DATE,
  title text NOT NULL,
  description text,
  type text NOT NULL DEFAULT 'lectie',
  -- lectie, activitate_extras, sedinta, intalnire_parinti, voluntariat,
  -- concurs, proiect, vizita, training, observatie, alta
  class_id uuid REFERENCES public.classes(id) ON DELETE SET NULL,
  student_ids uuid[] NOT NULL DEFAULT '{}',
  results text,
  notes text,
  next_steps text,
  relevant_for_annual_report boolean NOT NULL DEFAULT false,
  academic_year text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_journal TO authenticated;
GRANT ALL ON public.portfolio_journal TO service_role;

ALTER TABLE public.portfolio_journal ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages all journal"
  ON public.portfolio_journal FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teacher manages own journal"
  ON public.portfolio_journal FOR ALL TO authenticated
  USING (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'))
  WITH CHECK (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'));

CREATE INDEX idx_pj_teacher_date ON public.portfolio_journal(teacher_id, date DESC);

CREATE TRIGGER trg_pj_updated
  BEFORE UPDATE ON public.portfolio_journal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- portfolio_teacher_items --------------------------------------------
CREATE TABLE public.portfolio_teacher_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  category text NOT NULL DEFAULT 'altele',
  -- cv, adeverinta, certificat, diploma, curs, proiect, raport,
  -- material_didactic, aplicatie, comisie, altele
  title text NOT NULL,
  description text,
  version text,
  year text,
  pinned boolean NOT NULL DEFAULT false,
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_teacher_items TO authenticated;
GRANT ALL ON public.portfolio_teacher_items TO service_role;

ALTER TABLE public.portfolio_teacher_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages all teacher items"
  ON public.portfolio_teacher_items FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teacher manages own teacher items"
  ON public.portfolio_teacher_items FOR ALL TO authenticated
  USING (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'))
  WITH CHECK (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'));

CREATE INDEX idx_pti_teacher ON public.portfolio_teacher_items(teacher_id);

CREATE TRIGGER trg_pti_updated
  BEFORE UPDATE ON public.portfolio_teacher_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- portfolio_student_diplomas ------------------------------------------
CREATE TABLE public.portfolio_student_diplomas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  student_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  contest text NOT NULL,
  award text,
  date date,
  description text,
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  academic_year text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_student_diplomas TO authenticated;
GRANT ALL ON public.portfolio_student_diplomas TO service_role;

ALTER TABLE public.portfolio_student_diplomas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Admin manages all student diplomas"
  ON public.portfolio_student_diplomas FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teacher manages own student diplomas"
  ON public.portfolio_student_diplomas FOR ALL TO authenticated
  USING (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'))
  WITH CHECK (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'));

CREATE POLICY "Student reads own diplomas"
  ON public.portfolio_student_diplomas FOR SELECT TO authenticated
  USING (student_id = auth.uid());

CREATE INDEX idx_psd_teacher ON public.portfolio_student_diplomas(teacher_id);
CREATE INDEX idx_psd_student ON public.portfolio_student_diplomas(student_id);

CREATE TRIGGER trg_psd_updated
  BEFORE UPDATE ON public.portfolio_student_diplomas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Auto-attach student diploma into student's portfolio
CREATE OR REPLACE FUNCTION public.portfolio_student_diploma_to_item()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM public.portfolio_items
    WHERE source = 'diploma' AND source_id = NEW.id
  ) THEN
    INSERT INTO public.portfolio_items (
      student_id, teacher_id, title, description, source, source_id,
      file_path, file_name, file_size, mime_type, academic_year, visible_to_student
    ) VALUES (
      NEW.student_id,
      NEW.teacher_id,
      'Diplomă: ' || NEW.contest || COALESCE(' — ' || NEW.award, ''),
      NEW.description,
      'diploma',
      NEW.id,
      NEW.file_path, NEW.file_name, NEW.file_size, NEW.mime_type,
      NEW.academic_year, true
    );
  ELSE
    UPDATE public.portfolio_items
      SET title = 'Diplomă: ' || NEW.contest || COALESCE(' — ' || NEW.award, ''),
          description = NEW.description,
          file_path = NEW.file_path,
          file_name = NEW.file_name,
          file_size = NEW.file_size,
          mime_type = NEW.mime_type,
          academic_year = NEW.academic_year,
          updated_at = now()
      WHERE source = 'diploma' AND source_id = NEW.id;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_psd_to_item
  AFTER INSERT OR UPDATE ON public.portfolio_student_diplomas
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_student_diploma_to_item();

-- Extend file-access check to support new path prefixes ---------------
CREATE OR REPLACE FUNCTION public.can_access_portfolio_file(_user_id uuid, _path text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _parts text[];
  _kind text;
  _id uuid;
BEGIN
  IF _user_id IS NULL THEN RETURN false; END IF;
  IF public.has_role(_user_id, 'admin'::app_role) THEN RETURN true; END IF;
  _parts := string_to_array(_path, '/');
  IF array_length(_parts, 1) < 2 THEN RETURN false; END IF;
  _kind := _parts[1];
  BEGIN
    _id := _parts[2]::uuid;
  EXCEPTION WHEN OTHERS THEN RETURN false;
  END;

  IF _kind = 'submissions' THEN
    RETURN public.is_portfolio_submission_student(_user_id, _id)
        OR public.is_portfolio_submission_teacher(_user_id, _id);

  ELSIF _kind = 'items' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.portfolio_items
      WHERE id = _id
        AND (teacher_id = _user_id
             OR (student_id = _user_id AND visible_to_student = true))
    );

  ELSIF _kind = 'competitions' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.portfolio_competition_signups s
      JOIN public.portfolio_competitions c ON c.id = s.competition_id
      WHERE s.id = _id
        AND (c.teacher_id = _user_id OR s.student_id = _user_id)
    );

  ELSIF _kind = 'documents' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.portfolio_documents
      WHERE id = _id AND teacher_id = _user_id
    );

  ELSIF _kind = 'journal' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.portfolio_journal
      WHERE id = _id AND teacher_id = _user_id
    );

  ELSIF _kind = 'teacher-items' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.portfolio_teacher_items
      WHERE id = _id AND teacher_id = _user_id
    );

  ELSIF _kind = 'student-diplomas' THEN
    RETURN EXISTS (
      SELECT 1 FROM public.portfolio_student_diplomas
      WHERE id = _id AND (teacher_id = _user_id OR student_id = _user_id)
    );
  END IF;

  RETURN false;
END;
$$;
