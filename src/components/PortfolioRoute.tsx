import { Navigate } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";

export function PortfolioRoute({ children }: { children: React.ReactNode }) {
  const { session, profile, loading, hasModuleAccess } = useAuth();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace />;
  if (profile?.must_change_password) return <Navigate to="/change-password" replace />;
  if (!hasModuleAccess("portfolio")) return <Navigate to="/app" replace />;

  return <>{children}</>;
}
