import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { GraduationCap, LayoutDashboard, CalendarDays, Ticket, LogOut } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import PushNotificationToggle from "@/components/PushNotificationToggle";

const navItems = [
  { title: "Panou principal", icon: LayoutDashboard, path: "/student" },
  { title: "Evenimente", icon: CalendarDays, path: "/student/events" },
  { title: "Biletele mele", icon: Ticket, path: "/student/tickets" },
];

export default function StudentLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col">
      <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b bg-card px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-semibold">CNCV</span>
        </div>
        <div className="flex items-center gap-1">
          <PushNotificationToggle />
          <NotificationBell />
          <span className="text-sm text-muted-foreground hidden sm:inline">{profile?.display_name}</span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <main className="flex-1 overflow-auto p-4 pb-20">
        <Outlet />
      </main>
      <nav className="fixed bottom-0 left-0 right-0 z-30 flex items-center justify-around border-t bg-card p-2">
        {navItems.map((item) => (
          <Button
            key={item.path}
            variant="ghost"
            className={`flex flex-col items-center gap-1 h-auto py-2 px-3 ${
              location.pathname === item.path
                ? "text-primary"
                : "text-muted-foreground"
            }`}
            onClick={() => navigate(item.path)}
          >
            <item.icon className="h-5 w-5" />
            <span className="text-xs">{item.title}</span>
          </Button>
        ))}
      </nav>
    </div>
  );
}
