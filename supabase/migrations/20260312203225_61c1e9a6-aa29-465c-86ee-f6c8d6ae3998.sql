
-- Create a security definer function to check event ownership without triggering RLS
CREATE OR REPLACE FUNCTION public.is_event_creator(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.events
    WHERE id = _event_id AND created_by = _user_id
  )
$$;

-- Drop the recursive policy on coordinator_assignments
DROP POLICY IF EXISTS "Teachers manage assignments for own events" ON public.coordinator_assignments;

-- Recreate using security definer function (no recursion)
CREATE POLICY "Teachers manage assignments for own events"
ON public.coordinator_assignments
FOR ALL TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND
  public.is_event_creator(event_id, auth.uid())
)
WITH CHECK (
  has_role(auth.uid(), 'teacher'::app_role) AND
  public.is_event_creator(event_id, auth.uid())
);

-- Also fix the events policy that references coordinator_assignments
-- Create a security definer function for coordinator check
CREATE OR REPLACE FUNCTION public.is_coordinator_for_event(_event_id uuid, _user_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.coordinator_assignments
    WHERE event_id = _event_id AND teacher_id = _user_id
  )
$$;

-- Drop and recreate the events SELECT policy to use security definer
DROP POLICY IF EXISTS "Authenticated read published events" ON public.events;

CREATE POLICY "Authenticated read published events"
ON public.events
FOR SELECT TO authenticated
USING (
  (published = true AND status = 'published'::event_status)
  OR has_role(auth.uid(), 'admin'::app_role)
  OR (has_role(auth.uid(), 'coordinator_teacher'::app_role) AND public.is_coordinator_for_event(id, auth.uid()))
);
