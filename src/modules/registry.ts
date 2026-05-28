import { Calendar, BookOpen, Users, type LucideIcon } from "lucide-react";

export type AppRole =
  | "admin"
  | "student"
  | "homeroom_teacher"
  | "coordinator_teacher"
  | "teacher"
  | "manager"
  | "cse";

export interface AppModule {
  key: string;
  label: string;
  description: string;
  icon: LucideIcon;
  /** Cale per rol. Dacă un rol nu apare aici, modulul nu se afișează pentru el. */
  pathByRole: Partial<Record<AppRole, string>>;
}

export const MODULES: AppModule[] = [
  {
    key: "events",
    label: "Evenimente",
    description: "Sesiuni, rezervări, prezență și rapoarte pentru activitățile CNCV.",
    icon: Calendar,
    pathByRole: {
      admin: "/admin",
      student: "/student",
      teacher: "/prof",
      homeroom_teacher: "/prof",
      cse: "/prof",
      coordinator_teacher: "/coordinator",
      manager: "/manager",
    },
  },
  {
    key: "schedule",
    label: "Orar & Meniu",
    description: "Orarul clasei și meniul zilnic al cantinei.",
    icon: BookOpen,
    pathByRole: {
      admin: "/admin/schedules",
      student: "/student/orar",
    },
  },
  {
    key: "clubs_volunteer",
    label: "Cluburi & Voluntariat",
    description: "Cluburi recurente și proiecte de voluntariat cu înscrieri și prezență.",
    icon: Users,
    pathByRole: {
      admin: "/admin/clubs",
      cse: "/prof/clubs",
      student: "/student/clubs",
      manager: "/manager",
    },
  },
];

/** Returnează modulele vizibile pentru utilizator în funcție de rolurile sale. */
export function getEnabledModules(roles: string[]): { module: AppModule; path: string }[] {
  return MODULES.flatMap((m) => {
    for (const r of roles) {
      const p = m.pathByRole[r as AppRole];
      if (p) return [{ module: m, path: p }];
    }
    return [];
  });
}
