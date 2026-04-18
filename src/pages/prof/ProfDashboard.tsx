import { formatDate } from "@/lib/time";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { CalendarDays, Clock, MapPin, ScanLine, Users, Plus } from "lucide-react";

export default function ProfDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  // Events I created
  const { data: myEvents = [], isLoading: loadingCreated } = useQuery({
    queryKey: ["prof_my_events", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("created_by", user!.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Events I'm assigned to as coordinator
  const { data: assignments = [], isLoading: loadingAssigned } = useQuery({
    queryKey: ["prof_coord_assignments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordinator_assignments")
        .select("*, events(*)")
        .eq("teacher_id", user!.id);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  // Norm data
  const { data: normData } = useQuery({
    queryKey: ["prof_norm", user?.id],
    enabled: !!user && !!profile,
    queryFn: async () => {
      const teachingNorm = (profile as any)?.teaching_norm;
      if (!teachingNorm || teachingNorm <= 0) return null;

      const { data: sessions } = await supabase
        .from("program_sessions").select("id, name").eq("status", "active");
      if (!sessions?.length) return null;

      const sessionIds = sessions.map((s) => s.id);
      const { data: rules } = await supabase
        .from("class_participation_rules").select("session_id").in("session_id", sessionIds).limit(1);
      if (!rules?.length) return null;

      const results = [];
      for (const session of sessions) {
        const hasRule = rules.some((r) => r.session_id === session.id);
        if (!hasRule) continue;
        const { data: coords } = await supabase
          .from("coordinator_assignments").select("event_id").eq("teacher_id", user!.id);
        const eventIds = (coords || []).map((c) => c.event_id);
        if (!eventIds.length) { results.push({ sessionName: session.name, organized: 0, norm: teachingNorm }); continue; }
        const { data: events } = await supabase
          .from("events").select("counted_duration_hours, status, date").in("id", eventIds).eq("session_id", session.id);
        const today = new Date().toISOString().slice(0, 10);
        const organized = (events || [])
          .filter((e: any) => e.status === "closed" || (e.status === "published" && e.date <= today))
          .reduce((s, e) => s + (e.counted_duration_hours || 0), 0);
        results.push({ sessionName: session.name, organized, norm: teachingNorm });
      }
      return results.length ? results : null;
    },
  });

  // Coordinator events split by status
  const today = new Date().toISOString().slice(0, 10);
  const validAssignments = assignments.filter((a) => a.events && a.events.status !== "draft" && a.events.status !== "cancelled");

  const activeCoord = validAssignments.filter((a) => {
    const ev = a.events;
    return ev.status === "published" && ev.date >= today;
  }).sort((a, b) => (a.events.date || "").localeCompare(b.events.date || ""));

  const pastCoord = validAssignments.filter((a) => {
    const ev = a.events;
    return ev.status === "closed" || (ev.status === "published" && ev.date < today);
  }).sort((a, b) => (b.events.date || "").localeCompare(a.events.date || ""));

  // Total hours: only events that actually took place (closed OR published+past)
  const totalHours = pastCoord.reduce((sum, a) => sum + (a.events?.counted_duration_hours || 0), 0);
  const totalCoordEvents = pastCoord.length + activeCoord.length;

  const activeCreated = myEvents.filter((e) => e.status === "published" || e.status === "draft");

  const isLoading = loadingCreated || loadingAssigned;

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="min-w-0">
          <h1 className="font-display text-xl sm:text-2xl font-bold">
            Bună, {profile?.first_name || "Profesor"}! 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Evenimentele tale și orele acumulate.
          </p>
        </div>
        <Button onClick={() => navigate("/prof/events")} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Eveniment nou
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-3 grid-cols-1 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold">{totalHours}h</p>
              <p className="text-xs text-muted-foreground">Ore desfășurate (coordonare)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CalendarDays className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold">{myEvents.length}</p>
              <p className="text-xs text-muted-foreground">Evenimente create</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-7 w-7 sm:h-8 sm:w-8 text-primary shrink-0" />
            <div className="min-w-0">
              <p className="text-xl sm:text-2xl font-bold">{totalCoordEvents}</p>
              <p className="text-xs text-muted-foreground">Evenimente coordonate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Norm progress */}
      {normData && normData.map((nd, idx) => (
        <Card key={idx}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between gap-2">
              <p className="text-sm font-medium truncate">Norma — {nd.sessionName}</p>
              <Badge variant={nd.organized >= nd.norm ? "default" : "secondary"} className="shrink-0">
                {nd.organized}h / {nd.norm}h
              </Badge>
            </div>
            <Progress value={Math.min(100, (nd.organized / nd.norm) * 100)} className="h-2" />
            <p className="text-xs text-muted-foreground">
              {nd.organized >= nd.norm
                ? "✅ Norma îndeplinită"
                : `Mai ai nevoie de ${nd.norm - nd.organized}h organizate`}
            </p>
          </CardContent>
        </Card>
      ))}

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Se încarcă…</div>
      ) : (
        <>
          {/* Active coordinator events */}
          {activeCoord.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-base sm:text-lg font-semibold">
                Evenimente de coordonat ({activeCoord.length})
              </h2>
              {activeCoord.map((a: any) => {
                const ev = a.events;
                return (
                  <Card key={a.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium break-words">{ev.title}</p>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3 shrink-0" /> {formatDate(ev.date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 shrink-0" /> {ev.start_time?.slice(0, 5)} – {ev.end_time?.slice(0, 5)}
                            </span>
                            {ev.location && (
                              <span className="flex items-center gap-1 min-w-0">
                                <MapPin className="h-3 w-3 shrink-0" /> <span className="truncate">{ev.location}</span>
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary" className="shrink-0">{ev.counted_duration_hours}h</Badge>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <Button size="sm" className="w-full sm:flex-1" onClick={() => navigate(`/prof/scan/${ev.id}`)}>
                          <ScanLine className="mr-2 h-4 w-4" /> Scanează QR
                        </Button>
                        <Button variant="outline" size="sm" className="w-full sm:flex-1" onClick={() => navigate(`/prof/event/${ev.id}`)}>
                          <Users className="mr-2 h-4 w-4" /> Participanți
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Past coordinator events (history) */}
          {pastCoord.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-base sm:text-lg font-semibold">
                Istoric coordonare ({pastCoord.length})
              </h2>
              {pastCoord.slice(0, 10).map((a: any) => {
                const ev = a.events;
                return (
                  <Card key={a.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate(`/prof/event/${ev.id}`)}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-medium break-words">{ev.title}</p>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3 shrink-0" /> {formatDate(ev.date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3 shrink-0" /> {ev.start_time?.slice(0, 5)} – {ev.end_time?.slice(0, 5)}
                            </span>
                          </div>
                        </div>
                        <Badge variant="outline" className="shrink-0">{ev.counted_duration_hours}h</Badge>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
              {pastCoord.length > 10 && (
                <p className="text-xs text-muted-foreground text-center">
                  ... și încă {pastCoord.length - 10} evenimente coordonate
                </p>
              )}
            </div>
          )}

          {/* My created events */}
          {activeCreated.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-base sm:text-lg font-semibold">
                Evenimentele mele ({activeCreated.length})
              </h2>
              {activeCreated.map((ev) => (
                <Card key={ev.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate(`/prof/events/${ev.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <p className="font-medium break-words">{ev.title}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3 shrink-0" /> {formatDate(ev.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3 shrink-0" /> {ev.start_time?.slice(0, 5)} – {ev.end_time?.slice(0, 5)}
                          </span>
                        </div>
                      </div>
                      <Badge variant={ev.status === "published" ? "default" : "secondary"} className="shrink-0">
                        {ev.status === "draft" ? "Ciornă" : ev.status === "published" ? "Publicat" : ev.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeCreated.length === 0 && activeCoord.length === 0 && pastCoord.length === 0 && (
            <Card>
              <CardContent className="py-8 text-center text-muted-foreground">
                <CalendarDays className="mx-auto mb-2 h-8 w-8" />
                <p>Nu ai evenimente momentan. Creează primul tău eveniment!</p>
              </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
