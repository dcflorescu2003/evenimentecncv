import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarTrigger,
} from "@/components/ui/sidebar";
import { Button } from "@/components/ui/button";
import {
  LayoutDashboard,
  Calendar,
  Users,
  GraduationCap,
  FileUp,
  CalendarDays,
  BarChart3,
  Shield,
  LogOut,
  KeyRound,
  QrCode,
} from "lucide-react";

const menuItems = [
  { title: "Panou principal", icon: LayoutDashboard, path: "/admin" },
  { title: "Sesiuni program", icon: Calendar, path: "/admin/sessions" },
  { title: "Clase", icon: GraduationCap, path: "/admin/classes" },
  { title: "Import CSV", icon: FileUp, path: "/admin/import" },
  { title: "Evenimente", icon: CalendarDays, path: "/admin/events" },
  { title: "Scanare bilete", icon: QrCode, path: "/admin/scan" },
  { title: "Utilizatori", icon: Users, path: "/admin/users" },
  { title: "Rapoarte", icon: BarChart3, path: "/admin/reports" },
  { title: "Jurnal audit", icon: Shield, path: "/admin/audit" },
  { title: "Credențiale PDF", icon: KeyRound, path: "/admin/credentials" },
];

export default function AdminLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader className="border-b border-sidebar-border p-4">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-sidebar-primary">
              <GraduationCap className="h-5 w-5 text-sidebar-primary-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-sidebar-foreground">CNCV Admin</span>
              <span className="text-xs text-sidebar-foreground/60">2025-2026</span>
            </div>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarGroup>
            <SidebarGroupLabel>Administrare</SidebarGroupLabel>
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
            <Button
              variant="ghost"
              size="icon"
              className="h-7 w-7 text-sidebar-foreground/70 hover:text-sidebar-foreground"
              onClick={signOut}
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        <header className="flex h-14 items-center gap-2 border-b px-4">
          <SidebarTrigger />
        </header>
        <main className="flex-1 overflow-auto p-6 pb-safe">
          <Outlet />
        </main>
      </SidebarInset>
    </SidebarProvider>
  );
}
