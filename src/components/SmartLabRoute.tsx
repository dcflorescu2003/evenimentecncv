import { ReactNode, useEffect, useState } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const STAFF_ROLES = ["admin", "teacher", "homeroom_teacher", "cse", "coordinator_teacher", "manager"];

/** Accesul la Smart Lab: personalul școlii + elevii desemnați voluntari. */
export function SmartLabRoute({ children }: { children: ReactNode }) {
  const { user, roles, loading } = useAuth();
  const [isVolunteer, setIsVolunteer] = useState<boolean | null>(null);

  const isStaff = roles.some((r) => STAFF_ROLES.includes(r));

  useEffect(() => {
    if (!user || isStaff) {
      setIsVolunteer(false);
      return;
    }
    let active = true;
    void (async () => {
      const { data } = await supabase
        .from("vr_volunteers")
        .select("id")
        .eq("student_id", user.id)
        .limit(1);
      if (active) setIsVolunteer((data ?? []).length > 0);
    })();
    return () => {
      active = false;
    };
  }, [user, isStaff]);

  if (loading || (!isStaff && isVolunteer === null)) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!user) return <Navigate to="/login" replace />;
  if (!isStaff && !isVolunteer) return <Navigate to="/app" replace />;

  return <>{children}</>;
}
