import { Calendar, BookOpen, Users, MessageSquare, FolderKanban, type LucideIcon } from "lucide-react";

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
  /** Dacă e setat, modulul e gated de o intrare în module_access cu această cheie (sau rol admin). */
  requiresModuleAccess?: string;
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
      teacher: "/prof/clubs",
      homeroom_teacher: "/prof/clubs",
      student: "/student/clubs",
      manager: "/manager",
    },
  },
  {
    key: "feedback",
    label: "Feedback",
    description: "Chestionare de feedback pentru elevi, profesori și evenimente.",
    icon: MessageSquare,
    pathByRole: {
      admin: "/admin/feedback",
      cse: "/prof/feedback",
      teacher: "/prof/feedback",
      homeroom_teacher: "/prof/feedback",
      student: "/student/feedback",
    },
  },
  {
    key: "portfolio",
    label: "Portofoliu",
    description: "Evidența activității de profesor: clase, elevi, teme, concursuri, documente.",
    icon: FolderKanban,
    pathByRole: {
      admin: "/portfolio",
      teacher: "/portfolio",
      homeroom_teacher: "/portfolio",
      cse: "/portfolio",
      student: "/student/portfolio",
    },
    requiresModuleAccess: "portfolio",
  },
];

/** Returnează modulele vizibile pentru utilizator în funcție de rolurile și accesele sale. */
export function getEnabledModules(
  roles: string[],
  moduleAccess: string[] = [],
): { module: AppModule; path: string }[] {
  const isAdmin = roles.includes("admin");
  return MODULES.flatMap((m) => {
    if (m.requiresModuleAccess && !isAdmin && !moduleAccess.includes(m.requiresModuleAccess)) {
      return [];
    }
    for (const r of roles) {
      const p = m.pathByRole[r as AppRole];
      if (p) return [{ module: m, path: p }];
    }
    return [];
  });
}
