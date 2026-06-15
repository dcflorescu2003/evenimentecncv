import { useNavigate, useLocation } from "react-router-dom";
import { LayoutGrid, Check, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuth } from "@/hooks/useAuth";
import { getEnabledModules } from "@/modules/registry";

interface Props {
  variant?: "icon" | "labeled";
  className?: string;
}

function detectCurrentKey(pathname: string): string {
  if (pathname.startsWith("/portfolio")) return "portfolio";
  if (
    pathname.startsWith("/admin/feedback") ||
    pathname.startsWith("/prof/feedback") ||
    pathname.startsWith("/student/feedback")
  ) return "feedback";
  if (
    pathname.startsWith("/admin/clubs") ||
    pathname.startsWith("/prof/clubs") ||
    pathname.startsWith("/student/clubs") ||
    pathname.startsWith("/student/volunteer")
  ) return "clubs_volunteer";
  if (
    pathname.startsWith("/admin/schedules") ||
    pathname.startsWith("/student/orar")
  ) return "schedule";
  return "events";
}

export function ModuleSwitcher({ variant = "icon", className }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { roles, moduleAccess } = useAuth();

  const modules = getEnabledModules(roles ?? [], moduleAccess ?? []);
  const detectedKey = detectCurrentKey(location.pathname);
  const current =
    modules.find((m) => m.module.key === detectedKey) ??
    modules.find((m) => m.module.key === "events") ??
    modules[0];

  if (!modules.length) return null;

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        {variant === "labeled" ? (
          <Button variant="ghost" size="sm" className={className} title="Module">
            <LayoutGrid className="h-4 w-4 sm:mr-2" />
            <span className="hidden sm:inline">{current?.module.label ?? "Module"}</span>
            <ChevronDown className="ml-1 h-3 w-3 opacity-60" />
          </Button>
        ) : (
          <Button variant="ghost" size="icon" className={className} title="Module" aria-label="Module">
            <LayoutGrid className="h-4 w-4" />
          </Button>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56 bg-card z-50">
        <DropdownMenuLabel>Module</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {modules.map(({ module, path }) => {
          const Icon = module.icon;
          const isActive = current?.module.key === module.key;
          return (
            <DropdownMenuItem
              key={module.key}
              onClick={() => navigate(path)}
              className="cursor-pointer"
            >
              <Icon className="mr-2 h-4 w-4" />
              <span className="flex-1">{module.label}</span>
              {isActive && <Check className="h-4 w-4 text-primary" />}
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={() => navigate("/app")} className="cursor-pointer text-muted-foreground">
          <LayoutGrid className="mr-2 h-4 w-4" />
          <span>Toate modulele</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
