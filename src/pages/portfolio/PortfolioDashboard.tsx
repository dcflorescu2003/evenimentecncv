import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Users2, ClipboardList, Inbox, HeartHandshake, Trophy, FileText, Activity, BarChart3 } from "lucide-react";
import { useAuth } from "@/hooks/useAuth";

interface StatCard {
  label: string;
  value: number | string;
  icon: typeof Users2;
  hint?: string;
}

export default function PortfolioDashboard() {
  const { user } = useAuth();
  const navigate = useNavigate();

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

  const { data: activeAssignmentCount = 0 } = useQuery({
    queryKey: ["portfolio_dashboard_assignments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("portfolio_assignments")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", user!.id)
        .eq("archived", false);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: pendingCount = 0 } = useQuery({
    queryKey: ["portfolio_dashboard_pending", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: assignments, error: aErr } = await supabase
        .from("portfolio_assignments")
        .select("id")
        .eq("teacher_id", user!.id);
      if (aErr) throw aErr;
      const ids = (assignments ?? []).map((a) => a.id);
      if (ids.length === 0) return 0;
      const { count, error } = await supabase
        .from("portfolio_submissions")
        .select("id", { count: "exact", head: true })
        .eq("status", "pending")
        .in("assignment_id", ids);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: involvementPending = 0 } = useQuery({
    queryKey: ["portfolio_dashboard_involvement_pending", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { count, error } = await supabase
        .from("portfolio_involvement")
        .select("id", { count: "exact", head: true })
        .eq("teacher_id", user!.id)
        .eq("status", "pending");
      if (error) throw error;
      return count ?? 0;
    },
  });

  const { data: competitionStats = { active: 0, signups: 0 } } = useQuery({
    queryKey: ["portfolio_dashboard_competitions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: comps, error } = await supabase
        .from("portfolio_competitions")
        .select("id, status")
        .eq("teacher_id", user!.id);
      if (error) throw error;
      const active = (comps ?? []).filter((c) => c.status === "active").length;
      const ids = (comps ?? []).map((c) => c.id);
      if (ids.length === 0) return { active, signups: 0 };
      const { count } = await supabase
        .from("portfolio_competition_signups")
        .select("id", { count: "exact", head: true })
        .in("competition_id", ids);
      return { active, signups: count ?? 0 };
    },
  });

  const stats: StatCard[] = [
    { label: "Clase curente", value: classCount, icon: Users2, hint: "Gestionate de tine" },
    { label: "Teme active", value: activeAssignmentCount, icon: ClipboardList, hint: "Neînarhivate" },
    { label: "Lucrări nevalidate", value: pendingCount, icon: Inbox, hint: "Trimiteri în așteptare" },
    { label: "Implicare în așteptare", value: involvementPending, icon: HeartHandshake, hint: "Declarații elevi" },
    { label: "Concursuri active", value: competitionStats.active, icon: Trophy, hint: `${competitionStats.signups} elevi înscriși` },
    { label: "Documente cu termen", value: 0, icon: FileText, hint: "În curând" },
    { label: "Activități recente", value: 0, icon: Activity, hint: "În curând" },
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
        <Card
          className="cursor-pointer hover:bg-accent/40 transition-colors border-primary/40"
          onClick={() => navigate("/portfolio/reports")}
        >
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Rapoarte</CardTitle>
            <BarChart3 className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-sm font-medium">Generează PDF / CSV</div>
            <p className="text-xs text-muted-foreground mt-1">
              Clasă, elev, activitate, raport anual
            </p>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
