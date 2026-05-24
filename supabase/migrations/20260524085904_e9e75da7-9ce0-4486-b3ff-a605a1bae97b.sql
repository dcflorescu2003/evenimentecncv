ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS initials text;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_initials_length CHECK (initials IS NULL OR char_length(initials) <= 8);
CREATE INDEX IF NOT EXISTS idx_profiles_initials ON public.profiles (initials) WHERE initials IS NOT NULL;