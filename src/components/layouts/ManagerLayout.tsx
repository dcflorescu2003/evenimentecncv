import { useState } from "react";
import { Outlet, useNavigate, useLocation, useOutletContext } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { AlertTriangle, BarChart3, CalendarDays, CalendarRange, GraduationCap, LayoutDashboard, LogOut, User, Users } from "lucide-react";

const menuItems = [
  { title: "Panou principal", icon: LayoutDashboard, path: "/manager" },
  { title: "Raport sesiune", icon: CalendarRange, path: "/manager/sessions" },
  { title: "Raport eveniment", icon: CalendarDays, path: "/manager/events" },
  { title: "Raport pe zile", icon: BarChart3, path: "/manager/days" },
  { title: "Raport clase", icon: GraduationCap, path: "/manager/classes" },
  { title: "Raport elevi", icon: User, path: "/manager/students" },
  { title: "Raport profesori", icon: Users, path: "/manager/teachers" },
  { title: "Normă incompletă", icon: AlertTriangle, path: "/manager/incomplete" },
];

export type ManagerSessionContext = {
  sessionId: string;
  sessionName: string;
  sessions: Array<{ id: string; name: string; status: string; start_date: string; end_date: string }>;
};

export function useManagerSession() {
  return useOutletContext<ManagerSessionContext>();
}

export default function ManagerLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const { data: sessions } = useQuery({
    queryKey: ["mgr-all-sessions"],
    queryFn: async () => {
      const { data } = await supabase.from("program_sessions").select("id, name, status, start_date, end_date").order("start_date", { ascending: false });
      return data || [];
    },
  });

  // Default to active session, or the most recent one
  const [selectedSessionId, setSelectedSessionId] = useState<string>("");

  const effectiveSessionId = selectedSessionId || (() => {
    if (!sessions?.length) return "";
    const active = sessions.find((s) => s.status === "active");
    if (active) return active.id;
    // Find session that contains current date
    const today = new Date().toISOString().slice(0, 10);
    const current = sessions.find((s) => s.start_date <= today && s.end_date >= today);
    if (current) return current.id;
    return sessions[0].id;
  })();

  const sessionName = sessions?.find((s) => s.id === effectiveSessionId)?.name || "";

  const contextValue: ManagerSessionContext = {
    sessionId: effectiveSessionId,
    sessionName,
    sessions: sessions || [],
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <BarChart3 className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">Manager</span>
              <span className="text-xs text-sidebar-foreground/60">Rapoarte</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Sesiune</SidebarGroupLabel>
            <SidebarGroupContent>
              <div className="px-2 pb-2">
                <Select value={effectiveSessionId} onValueChange={setSelectedSessionId}>
                  <SelectTrigger className="w-full text-xs h-8">
                    <SelectValue placeholder="Selectează sesiunea" />
                  </SelectTrigger>
                  <SelectContent>
                    {sessions?.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name} {s.status === "active" ? "●" : ""}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </SidebarGroupContent>
          </SidebarGroup>
          <SidebarGroup>
            <SidebarGroupLabel>Rapoarte</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {menuItems.map((item) => (
                  <SidebarMenuItem key={item.path}>
                    <SidebarMenuButton
                      isActive={location.pathname === item.path}
                      onClick={() => navigate(item.path)}
                      tooltip={item.title}
                    >
                      <item.icon className="h-4 w-4" />
                      <span>{item.title}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        </SidebarContent>
        <SidebarFooter
          className="border-t border-sidebar-border p-3"
          style={{ paddingBottom: "max(env(safe-area-inset-bottom), 0.75rem)" }}
        >
          <div className="flex items-center justify-between">
            <span className="truncate text-xs text-sidebar-foreground/70">
              {profile?.display_name}
            </span>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-sidebar-foreground/70 hover:text-sidebar-foreground" onClick={signOut}>
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-3 sm:px-4 min-w-0">
          <SidebarTrigger />
          <span className="text-xs sm:text-sm text-muted-foreground truncate min-w-0">
            <span className="hidden sm:inline">Sesiune: </span>
            <span className="font-medium text-foreground">{sessionName || "—"}</span>
          </span>
        </header>
        <main className="flex-1 overflow-auto p-3 sm:p-6 pb-safe">
          <Outlet context={contextValue} />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
