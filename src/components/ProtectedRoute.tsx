import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

type AppRole = "admin" | "student" | "homeroom_teacher" | "coordinator_teacher" | "teacher" | "manager" | "cse";

interface ProtectedRouteProps {
  children: React.ReactNode;
  allowedRoles?: AppRole[];
}

export function ProtectedRoute({ children, allowedRoles }: ProtectedRouteProps) {
  const { session, roles, profile, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/login" replace />;
  }

  if (profile?.must_change_password) {
    return <Navigate to="/change-password" replace />;
  }

  if (allowedRoles && !allowedRoles.some((r) => roles.includes(r))) {
    // Redirect to appropriate dashboard based on role
    if (roles.includes("admin")) return <Navigate to="/admin" replace />;
    if (roles.includes("cse")) return <Navigate to="/prof" replace />;
    if (roles.includes("teacher")) return <Navigate to="/prof" replace />;
    if (roles.includes("homeroom_teacher")) return <Navigate to="/prof" replace />;
    if (roles.includes("student")) return <Navigate to="/student" replace />;
    if (roles.includes("coordinator_teacher")) return <Navigate to="/coordinator" replace />;
    if (roles.includes("manager")) return <Navigate to="/manager" replace />;
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
