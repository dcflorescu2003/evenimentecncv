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

export function ModuleSwitcher({ variant = "icon", className }: Props) {
  const navigate = useNavigate();
  const location = useLocation();
  const { roles } = useAuth();

  const modules = getEnabledModules(roles ?? []);

  // Determină modulul curent după prefixul căii
  const current = modules.find((m) => {
    if (m.module.key === "schedule") {
      return location.pathname.startsWith("/student/orar") ||
        location.pathname.startsWith("/admin/schedules");
    }
    return false;
  }) ?? modules.find((m) => m.module.key === "events") ?? modules[0];

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
