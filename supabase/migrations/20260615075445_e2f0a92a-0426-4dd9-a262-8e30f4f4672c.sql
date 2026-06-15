
-- ============================================================
-- 1) PROFILES: restrict email column access
-- ============================================================
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (
  id, first_name, last_name, username, display_name,
  is_active, must_change_password, teaching_norm,
  student_identifier, initials, created_at, updated_at
) ON public.profiles TO authenticated;
GRANT SELECT ON public.profiles TO service_role;

-- Admins and managers retain full SELECT (including email) via dedicated role grants.
-- Use a security-definer RPC for legitimate email lookups by admins.
CREATE OR REPLACE FUNCTION public.get_profile_emails(_user_ids uuid[])
RETURNS TABLE(id uuid, email text)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT p.id, p.email
  FROM public.profiles p
  WHERE p.id = ANY(_user_ids)
    AND (
      public.has_role(auth.uid(), 'admin'::app_role)
      OR public.has_role(auth.uid(), 'manager'::app_role)
    );
$$;

REVOKE ALL ON FUNCTION public.get_profile_emails(uuid[]) FROM public;
GRANT EXECUTE ON FUNCTION public.get_profile_emails(uuid[]) TO authenticated;

-- ============================================================
-- 2) ATTENDANCE_LOG: tighten INSERT policies
-- ============================================================

-- Helper: can _user_id modify attendance for the given ticket?
CREATE OR REPLACE FUNCTION public.can_modify_ticket_attendance(_user_id uuid, _ticket_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.tickets t
    JOIN public.reservations r ON r.id = t.reservation_id
    WHERE t.id = _ticket_id
      AND (
        public.has_role(_user_id, 'admin'::app_role)
        OR public.is_event_creator(r.event_id, _user_id)
        OR public.is_coordinator_for_event(r.event_id, _user_id)
        OR public.is_assistant_for_event(_user_id, r.event_id)
      )
  )
$$;

REVOKE ALL ON FUNCTION public.can_modify_ticket_attendance(uuid, uuid) FROM public;
GRANT EXECUTE ON FUNCTION public.can_modify_ticket_attendance(uuid, uuid) TO authenticated;

-- Drop old broad insert policies
DROP POLICY IF EXISTS "Admins and coordinators insert attendance log" ON public.attendance_log;
DROP POLICY IF EXISTS "Assistants insert attendance log" ON public.attendance_log;
DROP POLICY IF EXISTS "CSE insert attendance log" ON public.attendance_log;
DROP POLICY IF EXISTS "Homeroom teachers insert attendance log" ON public.attendance_log;
DROP POLICY IF EXISTS "Teachers insert attendance log" ON public.attendance_log;

-- Single tight insert policy: caller must be acting as themselves AND
-- be authorized to modify attendance for the referenced ticket.
CREATE POLICY "Authorized users insert attendance log"
ON public.attendance_log
FOR INSERT
TO authenticated
WITH CHECK (
  changed_by = auth.uid()
  AND public.can_modify_ticket_attendance(auth.uid(), ticket_id)
);
