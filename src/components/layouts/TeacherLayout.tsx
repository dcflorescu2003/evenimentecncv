import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { GraduationCap, LayoutDashboard, BarChart3, CalendarDays, LogOut, Users2 } from "lucide-react";

export default function TeacherLayout() {
  const { profile, roles, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const hasTeacherOrHomeroom = roles.includes("teacher") || roles.includes("homeroom_teacher");

  const navItems = [
    ...(hasTeacherOrHomeroom ? [{ title: "Dashboard", icon: LayoutDashboard, path: "/prof" }] : []),
    ...(hasTeacherOrHomeroom ? [{ title: "Evenimentele mele", icon: CalendarDays, path: "/prof/events" }] : []),
    { title: "Clasa mea", icon: Users2, path: "/teacher" },
    { title: "Rapoarte", icon: BarChart3, path: "/teacher/reports" },
  ];

  return (
    <div className="flex min-h-screen flex-col">
      <header className="header-safe sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-3 sm:px-4 shadow-sm">
        <div className="flex items-center gap-2 min-w-0">
          <GraduationCap className="h-6 w-6 text-primary shrink-0" />
          <span className="font-display text-base sm:text-lg font-semibold truncate">CNCV Diriginte</span>
        </div>
        <div className="flex items-center gap-2">
          <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[160px]">{profile?.display_name}</span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <div className="flex items-center gap-1 sm:gap-2 border-b bg-card px-2 sm:px-4 py-2 overflow-x-auto whitespace-nowrap">
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant={location.pathname === item.path ? "secondary" : "ghost"}
            size="sm"
            onClick={() => navigate(item.path)}
          >
            <item.icon className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{item.title}</span>
          </Button>
        ))}
      </div>
      <main className="flex-1 overflow-auto p-3 sm:p-4 pb-safe">
        <Outlet />
      </main>
    </div>
  );
}
