import { Navigate, useParams } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

/** Link partajat /c/:id sau /v/:id → pagina clubului / proiectului potrivită rolului. */
export default function HubLinkRedirect({ kind }: { kind: "club" | "volunteer" }) {
  const { id } = useParams<{ id: string }>();
  const { roles } = useAuth();
  const base = kind === "club" ? "clubs" : "volunteer";
  if (!id) return <Navigate to="/app" replace />;
  if (roles.includes("admin")) return <Navigate to={`/admin/${base}/${id}`} replace />;
  if (roles.some((r) => r === "teacher" || r === "homeroom_teacher" || r === "cse"))
    return <Navigate to={`/prof/${base}/${id}`} replace />;
  if (roles.includes("student") || roles.includes("coordinator_teacher"))
    return <Navigate to={`/student/${base}/${id}`} replace />;
  return <Navigate to="/app" replace />;
}
