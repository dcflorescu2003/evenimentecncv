import { Outlet } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { GraduationCap, LogOut } from "lucide-react";

export default function CoordinatorLayout() {
  const { profile, signOut } = useAuth();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-3 sm:px-4 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap className="h-6 w-6 text-primary shrink-0" />
          <span className="font-display text-base sm:text-lg font-semibold truncate">CNCV Asistent</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[160px]">{profile?.display_name}</span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-3 sm:p-4 pb-safe">
        <Outlet />
      </main>
    </div>
  );
}
