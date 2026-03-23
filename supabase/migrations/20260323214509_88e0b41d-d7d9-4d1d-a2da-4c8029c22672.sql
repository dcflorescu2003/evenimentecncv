
-- Drop the problematic policies
DROP POLICY IF EXISTS "Teachers read student class assignments for event participants" ON public.student_class_assignments;
DROP POLICY IF EXISTS "Coordinator teachers read student class assignments" ON public.student_class_assignments;

-- Create a security definer function to avoid recursion
CREATE OR REPLACE FUNCTION public.is_teacher_for_student(_teacher_id uuid, _student_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.reservations r
    JOIN public.coordinator_assignments ca ON ca.event_id = r.event_id
    WHERE ca.teacher_id = _teacher_id AND r.student_id = _student_id
  )
$$;

-- Recreate policies using the security definer function
CREATE POLICY "Teachers read student class assignments for event participants"
ON public.student_class_assignments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'teacher'::app_role) AND
  is_teacher_for_student(auth.uid(), student_id)
);

CREATE POLICY "Coordinator teachers read student class assignments"
ON public.student_class_assignments
FOR SELECT
TO authenticated
USING (
  has_role(auth.uid(), 'coordinator_teacher'::app_role) AND
  is_teacher_for_student(auth.uid(), student_id)
);
