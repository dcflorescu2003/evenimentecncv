import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { GraduationCap, LayoutDashboard, CalendarDays, ScanLine, LogOut } from "lucide-react";

const navItems = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/prof" },
  { title: "Evenimentele mele", icon: CalendarDays, path: "/prof/events" },
];

export default function ProfLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-semibold">CNCV Profesor</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">{profile?.display_name}</span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <div className="flex items-center gap-2 border-b bg-card px-4 py-2">
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant={location.pathname === item.path ? "secondary" : "ghost"}
            size="sm"
            onClick={() => navigate(item.path)}
          >
            <item.icon className="mr-2 h-4 w-4" />
            {item.title}
          </Button>
        ))}
      </div>
      <main className="flex-1 overflow-auto p-4">
        <Outlet />
      </main>
    </div>
  );
}
