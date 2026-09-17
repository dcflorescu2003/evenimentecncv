CREATE EXTENSION IF NOT EXISTS unaccent WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

CREATE OR REPLACE FUNCTION public.f_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
STRICT
SET search_path = public, extensions
AS $$ SELECT lower(extensions.unaccent('extensions.unaccent', $1)) $$;

CREATE INDEX IF NOT EXISTS idx_profiles_search_last ON public.profiles USING gin (public.f_unaccent(last_name) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_search_first ON public.profiles USING gin (public.f_unaccent(first_name) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_search_username ON public.profiles USING gin (public.f_unaccent(username) extensions.gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_profiles_search_full ON public.profiles USING gin (public.f_unaccent(last_name || ' ' || first_name) extensions.gin_trgm_ops);

CREATE OR REPLACE FUNCTION public.search_profiles(
  _term text,
  _roles public.app_role[] DEFAULT NULL,
  _limit integer DEFAULT 20
)
RETURNS TABLE (
  id uuid,
  first_name text,
  last_name text,
  username text,
  display_name text,
  roles text[]
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, extensions
AS $$
  WITH t AS (SELECT public.f_unaccent(coalesce(_term, '')) AS q)
  SELECT p.id, p.first_name, p.last_name, p.username, p.display_name,
         array_agg(DISTINCT ur.role::text) AS roles
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  CROSS JOIN t
  WHERE length(t.q) >= 2
    AND (_roles IS NULL OR EXISTS (
      SELECT 1 FROM public.user_roles ur2
      WHERE ur2.user_id = p.id AND ur2.role = ANY(_roles)
    ))
    AND (
      public.f_unaccent(p.last_name) LIKE '%' || t.q || '%'
      OR public.f_unaccent(p.first_name) LIKE '%' || t.q || '%'
      OR public.f_unaccent(p.username) LIKE '%' || t.q || '%'
      OR public.f_unaccent(p.last_name || ' ' || p.first_name) LIKE '%' || t.q || '%'
      OR public.f_unaccent(p.first_name || ' ' || p.last_name) LIKE '%' || t.q || '%'
    )
  GROUP BY p.id, p.first_name, p.last_name, p.username, p.display_name, t.q
  ORDER BY
    CASE
      WHEN public.f_unaccent(p.last_name) LIKE t.q || '%' THEN 0
      WHEN public.f_unaccent(p.first_name) LIKE t.q || '%' THEN 1
      ELSE 2
    END,
    p.last_name COLLATE "ro-RO-x-icu",
    p.first_name COLLATE "ro-RO-x-icu"
  LIMIT greatest(1, least(coalesce(_limit, 20), 100))
$$;

REVOKE ALL ON FUNCTION public.search_profiles(text, public.app_role[], integer) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.search_profiles(text, public.app_role[], integer) TO authenticated;