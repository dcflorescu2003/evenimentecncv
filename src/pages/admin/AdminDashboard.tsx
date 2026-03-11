import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Calendar, Users, Ticket, AlertTriangle, TrendingUp, Clock } from "lucide-react";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis, PieChart, Pie, Cell } from "recharts";

const STATUS_COLORS = {
  present: "hsl(160, 60%, 40%)",
  late: "hsl(38, 92%, 50%)",
  absent: "hsl(0, 72%, 51%)",
  excused: "hsl(220, 70%, 55%)",
  reserved: "hsl(220, 15%, 70%)",
  cancelled: "hsl(220, 10%, 55%)",
};

const pieConfig: ChartConfig = {
  present: { label: "Prezent", color: STATUS_COLORS.present },
  late: { label: "Întârziat", color: STATUS_COLORS.late },
  absent: { label: "Absent", color: STATUS_COLORS.absent },
  excused: { label: "Motivat", color: STATUS_COLORS.excused },
  reserved: { label: "Rezervat", color: STATUS_COLORS.reserved },
};

export default function AdminDashboard() {
  const { data: stats } = useQuery({
    queryKey: ["admin-dashboard-stats"],
    queryFn: async () => {
      const [sessionsRes, eventsRes, profilesRes, reservationsRes, ticketsRes, classesRes] =
        await Promise.all([
          supabase.from("program_sessions").select("id, name, status"),
          supabase.from("events").select("id, title, status, date, max_capacity, session_id"),
          supabase.from("profiles").select("id, is_active"),
          supabase.from("reservations").select("id, status, event_id"),
          supabase.from("tickets").select("id, status"),
          supabase.from("classes").select("id, is_active"),
        ]);

      const sessions = sessionsRes.data ?? [];
      const events = eventsRes.data ?? [];
      const profiles = profilesRes.data ?? [];
      const reservations = reservationsRes.data ?? [];
      const tickets = ticketsRes.data ?? [];
      const classes = classesRes.data ?? [];

      const activeSessions = sessions.filter(s => s.status === "active");
      const publishedEvents = events.filter(e => e.status === "published");
      const activeStudents = profiles.filter(p => p.is_active).length;
      const activeReservations = reservations.filter(r => r.status === "reserved").length;

      // Events with low capacity
      const lowCapacityEvents = publishedEvents.filter(e => {
        const reserved = reservations.filter(r => r.event_id === e.id && r.status === "reserved").length;
        return reserved >= e.max_capacity * 0.9;
      });

      // Upcoming events (next 7 days)
      const now = new Date();
      const weekFromNow = new Date(now.getTime() + 7 * 86400000);
      const upcomingEvents = events.filter(e => {
        const d = new Date(e.date);
        return d >= now && d <= weekFromNow && e.status === "published";
      });

      // Ticket status distribution
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

      // Events per session bar chart
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
    evenimente: { label: "Evenimente", color: "hsl(220, 70%, 45%)" },
  };

  return (
    <div className="space-y-6">
      <h1 className="font-display text-2xl font-bold">Panou principal</h1>

      {/* KPI Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <KPICard icon={Calendar} label="Sesiuni active" value={stats?.activeSessions ?? 0} sub={`din ${stats?.totalSessions ?? 0} total`} />
        <KPICard icon={TrendingUp} label="Evenimente publicate" value={stats?.publishedEvents ?? 0} sub={`din ${stats?.totalEvents ?? 0} total`} />
        <KPICard icon={Users} label="Elevi activi" value={stats?.activeStudents ?? 0} sub={`${stats?.activeClasses ?? 0} clase`} />
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
            <Card className="border-primary/30 bg-primary/5">
              <CardHeader className="pb-2">
                <CardTitle className="flex items-center gap-2 text-base">
                  <Clock className="h-4 w-4 text-primary" />
                  Evenimente săptămâna aceasta ({stats.upcomingEvents.length})
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-1">
                {stats.upcomingEvents.slice(0, 5).map(e => (
                  <p key={e.id} className="text-sm text-muted-foreground">
                    {e.date} — {e.title}
                  </p>
                ))}
              </CardContent>
            </Card>
          )}
        </div>
      )}

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
