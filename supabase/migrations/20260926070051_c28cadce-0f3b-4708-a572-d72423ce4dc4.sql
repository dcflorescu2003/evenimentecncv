CREATE TABLE public.app_versions (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  platform TEXT NOT NULL UNIQUE CHECK (platform IN ('android', 'ios', 'web')),
  min_version TEXT NOT NULL,
  latest_version TEXT NOT NULL,
  store_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);
GRANT SELECT ON public.app_versions TO authenticated;
GRANT SELECT ON public.app_versions TO anon;
GRANT ALL ON public.app_versions TO service_role;
ALTER TABLE public.app_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Anyone can read app versions" ON public.app_versions FOR SELECT TO authenticated, anon USING (true);
CREATE TRIGGER update_app_versions_updated_at BEFORE UPDATE ON public.app_versions FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();