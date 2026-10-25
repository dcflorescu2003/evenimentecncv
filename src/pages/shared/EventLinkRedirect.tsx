import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/** Link partajat /e/:id → pagina evenimentului potrivită rolului. */
export default function EventLinkRedirect() {
  const { id } = useParams<{ id: string }>();
  const { roles } = useAuth();
  if (!id) return <Navigate to="/app" replace />;
  if (roles.includes("admin")) return <Navigate to={`/admin/events/${id}`} replace />;
  if (roles.some((r) => r === "teacher" || r === "homeroom_teacher" || r === "cse"))
    return <Navigate to={`/prof/events/${id}`} replace />;
  if (roles.includes("student")) return <Navigate to={`/student/events/${id}`} replace />;
  if (roles.includes("coordinator_teacher")) return <Navigate to={`/coordinator/event/${id}`} replace />;
  if (roles.includes("manager")) return <Navigate to="/manager/events" replace />;
  return <Navigate to="/app" replace />;
}
