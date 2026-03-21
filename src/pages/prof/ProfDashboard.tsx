import { formatDate } from "@/lib/time";
import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
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

  // Norm data: check if there's an active session with participation rules
  const { data: normData } = useQuery({
    queryKey: ["prof_norm", user?.id],
    enabled: !!user && !!profile,
    queryFn: async () => {
      const teachingNorm = (profile as any)?.teaching_norm;
      if (!teachingNorm || teachingNorm <= 0) return null;

      // Find active sessions with class_participation_rules
      const { data: sessions } = await supabase
        .from("program_sessions").select("id, name").eq("status", "active");
      if (!sessions?.length) return null;

      // Check if any session has rules
      const sessionIds = sessions.map((s) => s.id);
      const { data: rules } = await supabase
        .from("class_participation_rules").select("session_id").in("session_id", sessionIds).limit(1);
      if (!rules?.length) return null;

      // Get organized hours per session
      const results = [];
      for (const session of sessions) {
        const hasRule = rules.some((r) => r.session_id === session.id);
        if (!hasRule) {
          const { data: allRules } = await supabase
            .from("class_participation_rules").select("session_id").eq("session_id", session.id).limit(1);
          if (!allRules?.length) continue;
        }
        const { data: coords } = await supabase
          .from("coordinator_assignments").select("event_id").eq("teacher_id", user!.id);
        const eventIds = (coords || []).map((c) => c.event_id);
        if (!eventIds.length) { results.push({ sessionName: session.name, organized: 0, norm: teachingNorm }); continue; }
        const { data: events } = await supabase
          .from("events").select("counted_duration_hours").in("id", eventIds).eq("session_id", session.id);
        const organized = (events || []).reduce((s, e) => s + (e.counted_duration_hours || 0), 0);
        results.push({ sessionName: session.name, organized, norm: teachingNorm });
      }
      return results.length ? results : null;
    },
  });

  // Calculate total hours from assigned events
  const totalHours = assignments.reduce((sum, a) => {
    return sum + (a.events?.counted_duration_hours || 0);
  }, 0);

  const activeCreated = myEvents.filter((e) => e.status === "published" || e.status === "draft");
  const activeAssigned = assignments.filter((a) => a.events?.status === "published");

  const isLoading = loadingCreated || loadingAssigned;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">
            Bună, {profile?.first_name || "Profesor"}! 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Evenimentele tale și orele acumulate.
          </p>
        </div>
        <Button onClick={() => navigate("/prof/events")}>
          <Plus className="mr-2 h-4 w-4" /> Eveniment nou
        </Button>
      </div>

      {/* Stats */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Clock className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{totalHours}h</p>
              <p className="text-xs text-muted-foreground">Ore totale (coordonare)</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <CalendarDays className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{myEvents.length}</p>
              <p className="text-xs text-muted-foreground">Evenimente create</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <Users className="h-8 w-8 text-primary" />
            <div>
              <p className="text-2xl font-bold">{assignments.length}</p>
              <p className="text-xs text-muted-foreground">Evenimente coordonate</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Norm progress */}
      {normData && normData.map((nd, idx) => (
        <Card key={idx}>
          <CardContent className="p-4 space-y-2">
            <div className="flex items-center justify-between">
              <p className="text-sm font-medium">Norma — {nd.sessionName}</p>
              <Badge variant={nd.organized >= nd.norm ? "default" : "secondary"}>
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
          {/* Events I'm coordinating */}
          {activeAssigned.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold">
                Evenimente de coordonat ({activeAssigned.length})
              </h2>
              {activeAssigned.map((a: any) => {
                const ev = a.events;
                if (!ev) return null;
                return (
                  <Card key={a.id}>
                    <CardContent className="p-4 space-y-3">
                      <div className="flex items-start justify-between">
                        <div>
                          <p className="font-medium">{ev.title}</p>
                          <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <CalendarDays className="h-3 w-3" /> {formatDate(ev.date)}
                            </span>
                            <span className="flex items-center gap-1">
                              <Clock className="h-3 w-3" /> {ev.start_time?.slice(0, 5)} – {ev.end_time?.slice(0, 5)}
                            </span>
                            {ev.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" /> {ev.location}
                              </span>
                            )}
                          </div>
                        </div>
                        <Badge variant="secondary">{ev.counted_duration_hours}h</Badge>
                      </div>
                      <div className="flex gap-2">
                        <Button size="sm" className="flex-1" onClick={() => navigate(`/prof/scan/${ev.id}`)}>
                          <ScanLine className="mr-2 h-4 w-4" /> Scanează QR
                        </Button>
                        <Button variant="outline" size="sm" className="flex-1" onClick={() => navigate(`/prof/event/${ev.id}`)}>
                          <Users className="mr-2 h-4 w-4" /> Participanți
                        </Button>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* My created events */}
          {activeCreated.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold">
                Evenimentele mele ({activeCreated.length})
              </h2>
              {activeCreated.map((ev) => (
                <Card key={ev.id} className="cursor-pointer hover:bg-muted/30 transition-colors" onClick={() => navigate(`/prof/events/${ev.id}`)}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between">
                      <div>
                        <p className="font-medium">{ev.title}</p>
                        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                          <span className="flex items-center gap-1">
                            <CalendarDays className="h-3 w-3" /> {formatDate(ev.date)}
                          </span>
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" /> {ev.start_time?.slice(0, 5)} – {ev.end_time?.slice(0, 5)}
                          </span>
                        </div>
                      </div>
                      <Badge variant={ev.status === "published" ? "default" : "secondary"}>
                        {ev.status === "draft" ? "Ciornă" : ev.status === "published" ? "Publicat" : ev.status}
                      </Badge>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}

          {activeCreated.length === 0 && activeAssigned.length === 0 && (
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
