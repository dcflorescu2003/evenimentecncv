ALTER TABLE public.clubs ADD COLUMN IF NOT EXISTS is_cse boolean NOT NULL DEFAULT false;
ALTER TABLE public.volunteer_projects ADD COLUMN IF NOT EXISTS is_cse boolean NOT NULL DEFAULT false;
ALTER TABLE public.feedback_forms ADD COLUMN IF NOT EXISTS is_cse boolean NOT NULL DEFAULT false;