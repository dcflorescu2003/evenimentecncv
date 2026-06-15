import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users2, ClipboardList, Inbox, HeartHandshake, Trophy, FileText, Activity, Bell } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface StatCard {
  label: string;
  value: number | string;
  icon: typeof Users2;
  hint?: string;
}

export default function PortfolioDashboard() {
  const { user } = useAuth();

  const { data: classCount = 0 } = useQuery({
    queryKey: ["portfolio_dashboard_classes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("portfolio_teacher_classes")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", user!.id);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const stats: StatCard[] = [
    { label: "Clase curente", value: classCount, icon: Users2, hint: "Gestionate de tine" },
    { label: "Teme active", value: 0, icon: ClipboardList, hint: "Disponibil în etapa 2" },
    { label: "Lucrări nevalidate", value: 0, icon: Inbox, hint: "Disponibil în etapa 2" },
    { label: "Voluntariat în așteptare", value: 0, icon: HeartHandshake, hint: "Disponibil în etapa 3" },
    { label: "Elevi la concursuri", value: 0, icon: Trophy, hint: "Disponibil în etapa 4" },
    { label: "Documente cu termen", value: 0, icon: FileText, hint: "Disponibil în etapa 5" },
    { label: "Activități recente", value: 0, icon: Activity, hint: "Disponibil în etapa 5" },
    { label: "Notificări", value: 0, icon: Bell, hint: "Disponibil ulterior" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">Portofoliu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Vedere de ansamblu asupra activității tale.
        </p>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <Card key={s.label}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">{s.label}</CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{s.value}</div>
                {s.hint && (
                  <p className="text-xs text-muted-foreground mt-1">{s.hint}</p>
                )}
              </CardContent>
            </Card>
          );
        })}
      </div>
    </div>
  );
}
