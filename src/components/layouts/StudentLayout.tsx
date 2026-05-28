import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { GraduationCap, LayoutDashboard, CalendarDays, Ticket, LogOut, CalendarRange, HeartHandshake, Users, MessageSquare, Inbox } from "lucide-react";
import NotificationBell from "@/components/NotificationBell";
import PushNotificationToggle from "@/components/PushNotificationToggle";
import { ModuleSwitcher } from "@/components/ModuleSwitcher";


const eventsNav = [
  { title: "Panou", icon: LayoutDashboard, path: "/student" },
  { title: "Evenimente", icon: CalendarDays, path: "/student/events" },
  { title: "Bilete", icon: Ticket, path: "/student/tickets" },
];

const scheduleNav = [
  { title: "Orar", icon: CalendarRange, path: "/student/orar" },
];

const clubsNav = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/student/clubs", tab: "dashboard" },
  { title: "Cluburile mele", icon: Users, path: "/student/clubs", tab: "my-clubs" },
  { title: "Voluntariat", icon: HeartHandshake, path: "/student/clubs", tab: "volunteer" },
];

const feedbackNav = [
  { title: "Dashboard", icon: LayoutDashboard, path: "/student/feedback", tab: "dashboard" },
  { title: "Feedbackul meu", icon: Inbox, path: "/student/feedback", tab: "mine" },
];

export default function StudentLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const isSchedule = location.pathname.startsWith("/student/orar");
  const isClubs = location.pathname.startsWith("/student/clubs") || location.pathname.startsWith("/student/volunteer");
  const isFeedback = location.pathname.startsWith("/student/feedback");
  const navItems = isFeedback ? feedbackNav : isClubs ? clubsNav : isSchedule ? scheduleNav : eventsNav;
  const useTabs = isClubs || isFeedback;
  const currentTab = new URLSearchParams(location.search).get("tab") ?? "dashboard";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="header-safe fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b bg-card px-4 shadow-sm">
        <div className="flex items-center gap-2">
          <GraduationCap className="h-6 w-6 text-primary" />
          <span className="font-display text-lg font-semibold">CNCV</span>
        </div>
        <div className="flex items-center gap-1">
          <ModuleSwitcher variant="labeled" />
          <PushNotificationToggle />
          <NotificationBell />
          <span className="text-sm text-muted-foreground hidden sm:inline">{profile?.display_name}</span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <div className="h-header-safe shrink-0" aria-hidden="true" />
      <main className="flex-1 overflow-auto p-4 pb-safe-nav">
        <Outlet />
      </main>
      
      <nav
        className="fixed left-0 right-0 z-30 flex items-center justify-around border-t bg-card px-2 pt-2"
        style={{ bottom: 0, paddingBottom: "max(env(safe-area-inset-bottom), 1.25rem)" }}
      >
        {navItems.map((item: any) => {
          const isActive = useTabs && "tab" in item
            ? location.pathname === item.path && currentTab === item.tab
            : location.pathname === item.path;
          const target = "tab" in item ? `${item.path}?tab=${item.tab}` : item.path;
          return (
            <Button
              key={`${item.path}-${item.title}`}
              variant="ghost"
              className={`flex flex-col items-center gap-1 h-auto py-2 px-3 ${
                isActive ? "text-primary" : "text-muted-foreground"
              }`}
              onClick={() => navigate(target)}
            >
              <item.icon className="h-5 w-5" />
              <span className="text-xs">{item.title}</span>
            </Button>
          );
        })}
      </nav>
    </div>
  );
}
