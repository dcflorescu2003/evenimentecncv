
-- ============ TABLES ============

CREATE TABLE public.portfolio_assignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  teacher_id uuid NOT NULL,
  class_id uuid REFERENCES public.classes(id) ON DELETE CASCADE,
  title text NOT NULL,
  description text,
  due_date date,
  allow_files boolean NOT NULL DEFAULT true,
  allow_text boolean NOT NULL DEFAULT true,
  academic_year text,
  archived boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portfolio_assignments_teacher ON public.portfolio_assignments(teacher_id);
CREATE INDEX idx_portfolio_assignments_class ON public.portfolio_assignments(class_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_assignments TO authenticated;
GRANT ALL ON public.portfolio_assignments TO service_role;
ALTER TABLE public.portfolio_assignments ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.portfolio_submissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  assignment_id uuid NOT NULL REFERENCES public.portfolio_assignments(id) ON DELETE CASCADE,
  student_id uuid NOT NULL,
  text_content text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','approved','rejected')),
  teacher_feedback text,
  submitted_at timestamptz NOT NULL DEFAULT now(),
  reviewed_at timestamptz,
  reviewed_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(assignment_id, student_id)
);
CREATE INDEX idx_portfolio_submissions_student ON public.portfolio_submissions(student_id);
CREATE INDEX idx_portfolio_submissions_assignment ON public.portfolio_submissions(assignment_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_submissions TO authenticated;
GRANT ALL ON public.portfolio_submissions TO service_role;
ALTER TABLE public.portfolio_submissions ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.portfolio_submission_files (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  submission_id uuid NOT NULL REFERENCES public.portfolio_submissions(id) ON DELETE CASCADE,
  file_path text NOT NULL,
  file_name text NOT NULL,
  file_size bigint,
  mime_type text,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portfolio_submission_files_submission ON public.portfolio_submission_files(submission_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_submission_files TO authenticated;
GRANT ALL ON public.portfolio_submission_files TO service_role;
ALTER TABLE public.portfolio_submission_files ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.portfolio_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  student_id uuid NOT NULL,
  teacher_id uuid NOT NULL,
  title text NOT NULL,
  description text,
  source text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual','submission','competition','diploma')),
  source_id uuid,
  file_path text,
  file_name text,
  file_size bigint,
  mime_type text,
  pinned boolean NOT NULL DEFAULT false,
  visible_to_student boolean NOT NULL DEFAULT true,
  academic_year text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_portfolio_items_student ON public.portfolio_items(student_id);
CREATE INDEX idx_portfolio_items_teacher ON public.portfolio_items(teacher_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_items TO authenticated;
GRANT ALL ON public.portfolio_items TO service_role;
ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;

-- ============ TRIGGERS ============
CREATE TRIGGER trg_portfolio_assignments_updated BEFORE UPDATE ON public.portfolio_assignments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_portfolio_submissions_updated BEFORE UPDATE ON public.portfolio_submissions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER trg_portfolio_items_updated BEFORE UPDATE ON public.portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- ============ HELPER FUNCTIONS ============

CREATE OR REPLACE FUNCTION public.is_portfolio_assignment_teacher(_user_id uuid, _assignment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.portfolio_assignments WHERE id = _assignment_id AND teacher_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_portfolio_submission_student(_user_id uuid, _submission_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.portfolio_submissions WHERE id = _submission_id AND student_id = _user_id)
$$;

CREATE OR REPLACE FUNCTION public.is_portfolio_submission_teacher(_user_id uuid, _submission_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portfolio_submissions s
    JOIN public.portfolio_assignments a ON a.id = s.assignment_id
    WHERE s.id = _submission_id AND a.teacher_id = _user_id
  )
$$;

CREATE OR REPLACE FUNCTION public.is_portfolio_assignment_visible_to_student(_user_id uuid, _assignment_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.portfolio_assignments a
    WHERE a.id = _assignment_id
      AND a.archived = false
      AND (
        EXISTS (
          SELECT 1 FROM public.student_class_assignments sca
          WHERE sca.student_id = _user_id AND sca.class_id = a.class_id
        )
        OR (
          a.class_id IS NULL AND EXISTS (
            SELECT 1 FROM public.student_class_assignments sca
            JOIN public.portfolio_teacher_classes ptc
              ON ptc.class_id = sca.class_id AND ptc.teacher_id = a.teacher_id
            WHERE sca.student_id = _user_id
          )
        )
      )
  )
$$;

CREATE OR REPLACE FUNCTION public.can_access_portfolio_file(_user_id uuid, _path text)
RETURNS boolean LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
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
  END IF;
  RETURN false;
END;
$$;

-- ============ POLICIES: portfolio_assignments ============

CREATE POLICY "Admin manages all assignments" ON public.portfolio_assignments
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teacher manages own assignments" ON public.portfolio_assignments
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'))
  WITH CHECK (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'));

CREATE POLICY "Student reads visible assignments" ON public.portfolio_assignments
  FOR SELECT TO authenticated
  USING (public.is_portfolio_assignment_visible_to_student(auth.uid(), id));

-- ============ POLICIES: portfolio_submissions ============

CREATE POLICY "Admin manages all submissions" ON public.portfolio_submissions
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Student manages own submissions" ON public.portfolio_submissions
  FOR ALL TO authenticated
  USING (student_id = auth.uid() AND public.is_portfolio_assignment_visible_to_student(auth.uid(), assignment_id))
  WITH CHECK (student_id = auth.uid() AND public.is_portfolio_assignment_visible_to_student(auth.uid(), assignment_id));

CREATE POLICY "Teacher manages submissions for own assignments" ON public.portfolio_submissions
  FOR ALL TO authenticated
  USING (public.is_portfolio_assignment_teacher(auth.uid(), assignment_id))
  WITH CHECK (public.is_portfolio_assignment_teacher(auth.uid(), assignment_id));

-- ============ POLICIES: portfolio_submission_files ============

CREATE POLICY "Admin manages all submission files" ON public.portfolio_submission_files
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Student manages own submission files" ON public.portfolio_submission_files
  FOR ALL TO authenticated
  USING (public.is_portfolio_submission_student(auth.uid(), submission_id))
  WITH CHECK (public.is_portfolio_submission_student(auth.uid(), submission_id));

CREATE POLICY "Teacher reads submission files for own assignments" ON public.portfolio_submission_files
  FOR SELECT TO authenticated
  USING (public.is_portfolio_submission_teacher(auth.uid(), submission_id));

-- ============ POLICIES: portfolio_items ============

CREATE POLICY "Admin manages all items" ON public.portfolio_items
  FOR ALL TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Teacher manages own items" ON public.portfolio_items
  FOR ALL TO authenticated
  USING (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'))
  WITH CHECK (teacher_id = auth.uid() AND public.has_module_access(auth.uid(), 'portfolio'));

CREATE POLICY "Student reads own visible items" ON public.portfolio_items
  FOR SELECT TO authenticated
  USING (student_id = auth.uid() AND visible_to_student = true);

-- ============ STORAGE POLICIES (portfolio-files) ============

DROP POLICY IF EXISTS "Portfolio owners delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Portfolio owners read own files" ON storage.objects;
DROP POLICY IF EXISTS "Portfolio owners update own files" ON storage.objects;
DROP POLICY IF EXISTS "Portfolio owners upload own files" ON storage.objects;

CREATE POLICY "Portfolio files: read"
  ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'portfolio-files' AND public.can_access_portfolio_file(auth.uid(), name));

CREATE POLICY "Portfolio files: insert"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'portfolio-files' AND public.can_access_portfolio_file(auth.uid(), name));

CREATE POLICY "Portfolio files: update"
  ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'portfolio-files' AND public.can_access_portfolio_file(auth.uid(), name))
  WITH CHECK (bucket_id = 'portfolio-files' AND public.can_access_portfolio_file(auth.uid(), name));

CREATE POLICY "Portfolio files: delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'portfolio-files' AND public.can_access_portfolio_file(auth.uid(), name));
