-- Tighten access to profiles.email
-- The `authenticated` role already lacks SELECT on profiles.email (only the
-- get_profile_emails SECURITY DEFINER RPC can return it for admin/manager).
-- The anon role still had a column-level grant on email even though no RLS
-- policy lets anon read profiles. Revoke it for defense in depth.
REVOKE SELECT (email) ON public.profiles FROM anon;