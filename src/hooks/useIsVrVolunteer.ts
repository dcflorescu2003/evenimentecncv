import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

const STAFF_ROLES = ["admin", "teacher", "homeroom_teacher", "cse", "coordinator_teacher", "manager"];

/** true dacă utilizatorul e personal al școlii sau elev desemnat voluntar Smart Lab. */
export function useCanAccessSmartLab() {
  const { user, roles } = useAuth();
  const isStaff = roles.some((r) => STAFF_ROLES.includes(r));

  const { data } = useQuery({
    queryKey: ["is-vr-volunteer", user?.id],
    enabled: !!user && !isStaff,
    queryFn: async () => {
      const { data } = await supabase
        .from("vr_volunteers")
        .select("id")
        .eq("student_id", user!.id)
        .limit(1);
      return (data ?? []).length > 0;
    },
  });

  return isStaff || data === true;
}
