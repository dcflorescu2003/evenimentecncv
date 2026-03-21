import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar, SidebarContent, SidebarFooter, SidebarGroup, SidebarGroupContent,
  SidebarGroupLabel, SidebarHeader, SidebarInset, SidebarMenu, SidebarMenuButton,
  SidebarMenuItem, SidebarProvider, SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import { BarChart3, CalendarDays, CalendarRange, GraduationCap, LayoutDashboard, LogOut, User, Users } from "lucide-react";

const menuItems = [
  { title: "Panou principal", icon: LayoutDashboard, path: "/manager" },
  { title: "Raport sesiune", icon: CalendarRange, path: "/manager/sessions" },
  { title: "Raport eveniment", icon: CalendarDays, path: "/manager/events" },
  { title: "Raport pe zile", icon: BarChart3, path: "/manager/days" },
  { title: "Raport clase", icon: GraduationCap, path: "/manager/classes" },
  { title: "Raport elevi", icon: User, path: "/manager/students" },
  { title: "Raport profesori", icon: Users, path: "/manager/teachers" },
];

export default function ManagerLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

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
        <SidebarFooter className="border-t border-sidebar-border p-3">
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
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 overflow-auto p-6">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
