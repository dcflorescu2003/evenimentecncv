import { Outlet, useNavigate, useLocation } from "react-router-dom";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { FolderKanban, LayoutDashboard, Users2, ClipboardList, HeartHandshake, Dice5, Trophy, FileText, BookOpen, User, LogOut, BarChart3 } from "lucide-react";
import { ModuleSwitcher } from "@/components/ModuleSwitcher";

export default function PortfolioLayout() {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const navItemsRow1 = [
    { title: "Dashboard", icon: LayoutDashboard, path: "/portfolio" },
    { title: "Clase și elevi", icon: Users2, path: "/portfolio/classes" },
    { title: "Teme", icon: ClipboardList, path: "/portfolio/assignments" },
    { title: "Implicare", icon: HeartHandshake, path: "/portfolio/involvement" },
    { title: "Concursuri", icon: Trophy, path: "/portfolio/competitions" },
    { title: "Cine iese la tablă", icon: Dice5, path: "/portfolio/board-picker" },
  ];
  const navItemsRow2 = [
    { title: "Documente", icon: FileText, path: "/portfolio/documents" },
    { title: "Jurnal", icon: BookOpen, path: "/portfolio/journal" },
    { title: "Portofoliul meu", icon: User, path: "/portfolio/teacher" },
    { title: "Rapoarte", icon: BarChart3, path: "/portfolio/reports" },
  ];

  const isActive = (path: string) =>
    path === "/portfolio"
      ? location.pathname === "/portfolio"
      : location.pathname.startsWith(path);

  return (
    <div className="flex min-h-screen flex-col">
      <header className="header-safe fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b bg-card px-3 sm:px-4 shadow-sm">
        <button
          type="button"
          onClick={() => navigate("/app")}
          className="flex items-center gap-2 min-w-0 hover:opacity-80 transition-opacity"
          aria-label="Toate modulele"
        >
          <FolderKanban className="h-6 w-6 text-primary shrink-0" />
          <span className="font-display text-base sm:text-lg font-semibold truncate">
            CNCV Portofoliu
          </span>
        </button>
        <div className="flex items-center gap-2">
          <ModuleSwitcher />
          <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[160px]">
            {profile?.display_name}
          </span>
          <Button variant="ghost" size="icon" onClick={signOut}>
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </header>
      <div className="h-header-safe shrink-0" aria-hidden="true" />
      <div className="sticky top-[calc(3.5rem+var(--safe-area-inset-top,env(safe-area-inset-top,0px)))] z-30 flex flex-col border-b bg-card">
        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 overflow-x-auto whitespace-nowrap">
          {navItemsRow1.map((item) => (
            <Button
              key={item.path}
              variant={isActive(item.path) ? "secondary" : "ghost"}
              size="sm"
              onClick={() => navigate(item.path)}
            >
              <item.icon className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{item.title}</span>
            </Button>
          ))}
        </div>
        <div className="flex items-center gap-1 sm:gap-2 px-2 sm:px-4 py-2 border-t overflow-x-auto whitespace-nowrap">
          {navItemsRow2.map((item) => (
            <Button
              key={item.path}
              variant={isActive(item.path) ? "secondary" : "ghost"}
              size="sm"
              onClick={() => navigate(item.path)}
            >
              <item.icon className="h-4 w-4 sm:mr-2" />
              <span className="hidden sm:inline">{item.title}</span>
            </Button>
          ))}
        </div>
      </div>
      <main className="flex-1 overflow-auto p-3 sm:p-4 pb-safe">
        <Outlet />
      </main>
    </div>
  );
}
