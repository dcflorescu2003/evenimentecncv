import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CalendarDays, GraduationCap, Users, User, Clock, BarChart3 } from "lucide-react";
import { useNavigate } from "react-router-dom";
import { useManagerSession } from "@/components/layouts/ManagerLayout";

export default function ManagerDashboard() {
  const navigate = useNavigate();
  const { sessionId, sessionName } = useManagerSession();

  const { data: stats, isLoading } = useQuery({
    queryKey: ["mgr-dashboard-stats", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const [eventsRes, studentsRes, teachersRes, classesRes] = await Promise.all([
        supabase.from("events").select("id, status, counted_duration_hours").eq("session_id", sessionId),
        supabase.from("user_roles").select("user_id").eq("role", "student"),
        supabase.from("user_roles").select("user_id").in("role", ["teacher", "homeroom_teacher", "coordinator_teacher"]),
        supabase.from("classes").select("id").eq("is_active", true),
      ]);

      const events = eventsRes.data || [];
      const uniqueTeachers = [...new Set((teachersRes.data || []).map((r) => r.user_id))];

      return {
        totalEvents: events.length,
        publishedEvents: events.filter((e) => e.status === "published").length,
        closedEvents: events.filter((e) => e.status === "closed").length,
        totalHours: events.reduce((s, e) => s + (e.counted_duration_hours || 0), 0),
        totalStudents: (studentsRes.data || []).length,
        totalTeachers: uniqueTeachers.length,
        totalClasses: (classesRes.data || []).length,
      };
    },
  });

  const cards = [
    { label: "Total evenimente", value: stats?.totalEvents ?? "—", icon: CalendarDays, color: "text-primary", route: "/manager/events" },
    { label: "Evenimente publicate", value: stats?.publishedEvents ?? "—", icon: CalendarDays, color: "text-green-600", route: "/manager/events" },
    { label: "Evenimente închise", value: stats?.closedEvents ?? "—", icon: CalendarDays, color: "text-muted-foreground", route: "/manager/events" },
    { label: "Ore totale sesiune", value: stats ? `${stats.totalHours}h` : "—", icon: Clock, color: "text-primary", route: "/manager/sessions" },
    { label: "Total elevi", value: stats?.totalStudents ?? "—", icon: User, color: "text-primary", route: "/manager/students" },
    { label: "Total profesori", value: stats?.totalTeachers ?? "—", icon: Users, color: "text-primary", route: "/manager/teachers" },
    { label: "Clase active", value: stats?.totalClasses ?? "—", icon: GraduationCap, color: "text-primary", route: "/manager/classes" },
  ];

  if (!sessionId) {
    return <p className="text-muted-foreground">Selectează o sesiune din meniul lateral.</p>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Dashboard Manager</h1>
        <p className="text-muted-foreground">Sesiune: <span className="font-medium text-foreground">{sessionName}</span></p>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Se încarcă...</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {cards.map((c) => (
            <Card key={c.label} className="cursor-pointer transition-shadow hover:shadow-md" onClick={() => navigate(c.route)}>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{c.label}</CardTitle>
                <c.icon className={`h-5 w-5 ${c.color}`} />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{c.value}</p>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
