import { formatDate } from "@/lib/time";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Calendar, Users, Ticket, AlertTriangle, TrendingUp, Clock, GraduationCap, Bell } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";
import { useState } from "react";

const STATUS_COLORS = {
  present: "hsl(160, 60%, 40%)",
  late: "hsl(38, 92%, 50%)",
  absent: "hsl(0, 72%, 51%)",
  excused: "hsl(350, 60%, 38%)",
  reserved: "hsl(350, 15%, 55%)",
  cancelled: "hsl(350, 10%, 45%)",
};

const pieConfig: ChartConfig = {
  present: { label: "Prezent", color: STATUS_COLORS.present },
  late: { label: "Întârziat", color: STATUS_COLORS.late },
  absent: { label: "Absent", color: STATUS_COLORS.absent },
  excused: { label: "Motivat", color: STATUS_COLORS.excused },
  reserved: { label: "Rezervat", color: STATUS_COLORS.reserved },
};

async function countActiveByRole(roles: ("student" | "teacher" | "homeroom_teacher" | "coordinator_teacher")[]) {
  const ids = new Set<string>();
  const PAGE = 1000;
  let from = 0;
  while (true) {
    const { data, error } = await supabase
      .from("user_roles")
      .select("user_id")
      .in("role", roles)
      .range(from, from + PAGE - 1);
    if (error || !data || data.length === 0) break;
    data.forEach((r) => ids.add(r.user_id));
    if (data.length < PAGE) break;
    from += PAGE;
  }
  if (ids.size === 0) return 0;

  const idArr = Array.from(ids);
  let active = 0;
  for (let i = 0; i < idArr.length; i += PAGE) {
    const chunk = idArr.slice(i, i + PAGE);
    const { data } = await supabase
      .from("profiles")
      .select("id")
      .in("id", chunk)
      .eq("is_active", true);
    active += data?.length ?? 0;
  }
  return active;
}

export default function AdminDashboard() {
  const navigate = useNavigate();
  const { user } = useAuth();
  const [testing, setTesting] = useState(false);

  async function sendTestPush() {
    if (!user) return;
    setTesting(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-push-to-user", {
        body: {
          user_id: user.id,
          title: "Test notificare push",
          body: "Dacă vezi acest mesaj, push-ul funcționează!",
          url: "/admin",
        },
      });
      if (error) throw error;
      console.log("[push test] response:", data);
      const r = data as any;

      // Construim un raport detaliat
      const lines: string[] = [];
      lines.push(`FCM: ${r?.fcmConfigured ? `configurat ✓ (project: ${r.fcmProjectId})` : "NU e configurat ✗"}`);
      if (r?.fcmError) lines.push(`⚠ ${r.fcmError}`);
      lines.push(`Tokene Android pentru contul tău: ${r?.tokensFound ?? 0}`);
      lines.push(`Trimise FCM: ${r?.fcmCount ?? 0}, Web Push: ${r?.webPushCount ?? 0}`);
      if (r?.fcmStatuses?.length) {
        lines.push(
          "Detalii: " +
            r.fcmStatuses
              .map((s: any) => `${s.token_prefix}…→${s.status}${s.invalid ? " (invalid)" : ""}`)
              .join(", ")
        );
      }
      if (r?.tokensFound === 0 && r?.fcmConfigured) {
        lines.push("→ Logează-te în aplicația Android cu acest cont pentru a salva tokenul FCM.");
      }

      const isSuccess = (r?.fcmCount ?? 0) > 0 || (r?.webPushCount ?? 0) > 0;
      const summary = `Trimis: ${r?.fcmCount ?? 0} FCM, ${r?.webPushCount ?? 0} web`;
      const description = lines.join("\n");

      if (isSuccess) {
        toast.success(summary, { description, duration: 15000 });
      } else {
        toast.warning(summary, { description, duration: 20000 });
      }
    } catch (e: any) {
      console.error("[push test] error:", e);
      toast.error("Eroare la trimiterea push-ului", { description: e.message });
    } finally {
      setTesting(false);
    }
  }

  const { data: stats } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const [sessionsRes, eventsRes, reservationsRes, ticketsRes, classesRes, activeStudents, activeTeachers] =
        await Promise.all([
          supabase.from("program_sessions").select("id, name, status"),
          supabase.from("events").select("id, title, status, date, max_capacity, session_id"),
          supabase.from("reservations").select("id, status, event_id"),
          supabase.from("tickets").select("id, status"),
          supabase.from("classes").select("id, is_active"),
          countActiveByRole(["student"]),
          countActiveByRole(["teacher", "homeroom_teacher", "coordinator_teacher"]),
        ]);

      const sessions = sessionsRes.data ?? [];
      const events = eventsRes.data ?? [];
      const reservations = reservationsRes.data ?? [];
      const tickets = ticketsRes.data ?? [];
      const classes = classesRes.data ?? [];

      const activeSessions = sessions.filter(s => s.status === "active");
      const publishedEvents = events.filter(e => e.status === "published");
      const activeReservations = reservations.filter(r => r.status === "reserved").length;

      const lowCapacityEvents = publishedEvents.filter(e => {
        const reserved = reservations.filter(r => r.event_id === e.id && r.status === "reserved").length;
        return reserved >= e.max_capacity * 0.9;
      });

      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 86400000);
      const upcomingEvents = events.filter(e => {
        const d = new Date(e.date);
        return d >= now && d <= weekFromNow && e.status === "published";
      });

      const ticketDist = tickets.reduce((acc, t) => {
        if (t.status !== "cancelled") {
          acc[t.status] = (acc[t.status] || 0) + 1;
        }
        return acc;
      }, {} as Record<string, number>);

      const pieData = Object.entries(ticketDist).map(([name, value]) => ({
        name,
        value,
        fill: STATUS_COLORS[name as keyof typeof STATUS_COLORS] ?? "hsl(220, 10%, 50%)",
      }));

      const barData = sessions.map(s => ({
        name: s.name.length > 15 ? s.name.slice(0, 15) + "…" : s.name,
        evenimente: events.filter(e => e.session_id === s.id).length,
      }));

      return {
        totalSessions: sessions.length,
        activeSessions: activeSessions.length,
        totalEvents: events.length,
        publishedEvents: publishedEvents.length,
        activeStudents,
        activeTeachers,
        activeReservations,
        activeClasses: classes.filter(c => c.is_active).length,
        lowCapacityEvents,
        upcomingEvents,
        pieData,
        barData,
      };
    },
  });

  const barConfig: ChartConfig = {
    evenimente: { label: "Evenimente", color: "hsl(350, 60%, 30%)" },
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Panou principal</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <KPICard icon={Calendar} label="Sesiuni active" value={stats?.activeSessions ?? 0} sub={`din ${stats?.totalSessions ?? 0} total`} />
        <KPICard icon={TrendingUp} label="Evenimente publicate" value={stats?.publishedEvents ?? 0} sub={`din ${stats?.totalEvents ?? 0} total`} />
        <KPICard icon={Users} label="Elevi activi" value={stats?.activeStudents ?? 0} sub={`${stats?.activeClasses ?? 0} clase`} />
        <KPICard icon={GraduationCap} label="Profesori activi" value={stats?.activeTeachers ?? 0} />
        <KPICard icon={Ticket} label="Rezervări active" value={stats?.activeReservations ?? 0} />
      </div>

      {/* Alerts */}
      {stats && (stats.lowCapacityEvents.length > 0 || stats.upcomingEvents.length > 0) && (
        <div className="grid gap-4 md:grid-cols-2">
          {stats.lowCapacityEvents.length > 0 && (
            <Card className="border-warning/30 bg-warning/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <AlertTriangle className="h-4 w-4 text-warning" />
                  Capacitate aproape plină
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {stats.lowCapacityEvents.slice(0, 5).map(e => (
                  <p key={e.id} className="text-sm text-muted-foreground">{e.title}</p>
                ))}
              </CardContent>
            </Card>
          )}
          {stats.upcomingEvents.length > 0 && (
            <Card
              role="button"
              tabIndex={0}
              onClick={() => navigate("/admin/events")}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); navigate("/admin/events"); } }}
              className="cursor-pointer border-primary/30 bg-primary/5 transition-shadow hover:shadow-md focus:outline-none focus:ring-2 focus:ring-primary/40"
            >
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" />
                  Evenimente săptămâna aceasta ({stats.upcomingEvents.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {stats.upcomingEvents.slice(0, 5).map(e => (
                  <p key={e.id} className="text-sm text-muted-foreground">
                    {formatDate(e.date)} — {e.title}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      {/* Test push notifications */}
      <Card>
        <CardHeader className="pb-2">
          <CardTitle className="flex items-center gap-2 text-base">
            <Bell className="h-4 w-4 text-primary" />
            Test notificări push
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col items-start gap-2 sm:flex-row sm:items-center sm:justify-between">
          <p className="text-sm text-muted-foreground">
            Trimite o notificare push test către contul tău (web + Android).
            Răspunsul afișează status-ul FCM per token.
          </p>
          <Button onClick={sendTestPush} disabled={testing} variant="outline">
            {testing ? "Se trimite…" : "Trimite test"}
          </Button>
        </CardContent>
      </Card>

      {/* Charts */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Distribuție prezență</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.pieData && stats.pieData.length > 0 ? (
              <ChartContainer config={pieConfig} className="mx-auto aspect-square max-h-[250px]">
                <PieChart>
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Pie data={stats.pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={80}>
                    {stats.pieData.map((entry, i) => (
                      <Cell key={i} fill={entry.fill} />
                    ))}
                  </Pie>
                </PieChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Nu există date.</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Evenimente per sesiune</CardTitle>
          </CardHeader>
          <CardContent>
            {stats?.barData && stats.barData.length > 0 ? (
              <ChartContainer config={barConfig} className="max-h-[250px]">
                <BarChart data={stats.barData}>
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis allowDecimals={false} />
                  <ChartTooltip content={<ChartTooltipContent />} />
                  <Bar dataKey="evenimente" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ChartContainer>
            ) : (
              <p className="text-sm text-muted-foreground">Nu există date.</p>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function KPICard({ icon: Icon, label, value, sub }: { icon: any; label: string; value: number; sub?: string }) {
  return (
    <Card>
      <CardContent className="flex items-center gap-4 p-5">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <div>
          <p className="text-2xl font-bold">{value}</p>
          <p className="text-sm text-muted-foreground">{label}</p>
          {sub && <p className="text-xs text-muted-foreground/70">{sub}</p>}
        </div>
      </CardContent>
    </Card>
  );
}
