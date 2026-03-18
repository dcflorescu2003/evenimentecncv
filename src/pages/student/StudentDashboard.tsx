import { useState } from "react";
import { formatDate } from "@/lib/time";
import { useQuery } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { CalendarDays, Clock, Ticket, CheckCircle2, ArrowRight, HelpCircle, AlertTriangle } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Session = Tables<"program_sessions">;

export default function StudentDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();
  const [infoOpen, setInfoOpen] = useState(false);

  const { data: activeSessions = [] } = useQuery({
    queryKey: ["active_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_sessions")
        .select("*")
        .eq("status", "active")
        .order("start_date");
      if (error) throw error;
      return data as Session[];
    },
  });

  const { data: progressMap = {} } = useQuery({
    queryKey: ["student_progress", user?.id, activeSessions.map((s) => s.id)],
    queryFn: async () => {
      const results: Record<string, { reserved_hours: number; validated_hours: number; max_hours: number }> = {};
      for (const s of activeSessions) {
        const { data, error } = await supabase.rpc("get_student_progress", {
          _student_id: user!.id,
          _session_id: s.id,
        });
        if (!error && data) {
          results[s.id] = data as any;
        }
      }
      return results;
    },
    enabled: !!user && activeSessions.length > 0,
  });

  const { data: upcomingTickets = [] } = useQuery({
    queryKey: ["upcoming_tickets", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, events(*)")
        .eq("student_id", user!.id)
        .eq("status", "reserved")
        .order("created_at", { ascending: false })
        .limit(5);
      if (error) throw error;
      return data as (Tables<"reservations"> & { events: Tables<"events"> })[];
    },
    enabled: !!user,
  });

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">
          Salut, {profile?.first_name || "Elev"}! 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Urmărește-ți progresul și rezervările.
        </p>
      </div>

      {/* Progress per session */}
      {activeSessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nu există sesiuni active momentan.
          </CardContent>
        </Card>
      ) : (
        activeSessions.map((s) => {
          const p = progressMap[s.id] || { reserved_hours: 0, validated_hours: 0, max_hours: 0 };
          const maxH = p.max_hours || 1;
          const reservedPct = Math.min((p.reserved_hours / maxH) * 100, 100);
          const validatedPct = Math.min((p.validated_hours / maxH) * 100, 100);
          const isComplete = p.validated_hours >= p.max_hours && p.max_hours > 0;

          return (
            <Card key={s.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{s.name}</CardTitle>
                  {isComplete && (
                    <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200">
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Complet
                    </Badge>
                  )}
                </div>
                <p className="text-xs text-muted-foreground">{formatDate(s.start_date)} — {formatDate(s.end_date)}</p>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid grid-cols-3 gap-3 text-center">
                  <div className="rounded-lg bg-muted p-3">
                    <CalendarDays className="mx-auto mb-1 h-5 w-5 text-primary" />
                    <p className="text-lg font-bold">{p.reserved_hours}</p>
                    <p className="text-xs text-muted-foreground">Ore rezervate</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-accent" />
                    <p className="text-lg font-bold">{p.validated_hours}</p>
                    <p className="text-xs text-muted-foreground">Ore validate</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <Clock className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
                    <p className="text-lg font-bold">{Math.max(p.max_hours - p.reserved_hours, 0)}</p>
                    <p className="text-xs text-muted-foreground">Ore rămase</p>
                  </div>
                </div>

                {p.max_hours > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progres validat</span>
                      <span>{p.validated_hours} / {p.max_hours}h</span>
                    </div>
                    <Progress value={validatedPct} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progres rezervat</span>
                      <span>{p.reserved_hours} / {p.max_hours}h</span>
                    </div>
                    <Progress value={reservedPct} className="h-2" />
                  </div>
                )}
              </CardContent>
            </Card>
          );
        })
      )}

      {/* Upcoming reservations */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold">Rezervările tale recente</h2>
          <Button variant="ghost" size="sm" onClick={() => navigate("/student/tickets")}>
            Toate <ArrowRight className="ml-1 h-4 w-4" />
          </Button>
        </div>
        {upcomingTickets.length === 0 ? (
          <Card>
            <CardContent className="py-6 text-center text-muted-foreground">
              <Ticket className="mx-auto mb-2 h-8 w-8" />
              <p>Nu ai rezervări încă.</p>
              <Button variant="link" onClick={() => navigate("/student/events")}>
                Explorează evenimente →
              </Button>
            </CardContent>
          </Card>
        ) : (
          upcomingTickets.map((r) => (
            <Card
              key={r.id}
              className="cursor-pointer hover:bg-muted/50 transition-colors"
              onClick={() => navigate(`/student/events/${r.event_id}`)}
            >
              <CardContent className="flex items-center justify-between p-4">
                <div>
                  <p className="font-medium">{r.events?.title}</p>
                  <p className="text-sm text-muted-foreground">
                    {formatDate(r.events?.date)} • {r.events?.start_time?.slice(0, 5)} – {r.events?.end_time?.slice(0, 5)}
                  </p>
                </div>
                <Badge variant="secondary">{r.events?.counted_duration_hours}h</Badge>
              </CardContent>
            </Card>
          ))
        )}
      </div>

      <Button className="w-full" onClick={() => navigate("/student/events")}>
        <CalendarDays className="mr-2 h-4 w-4" /> Explorează evenimente
      </Button>
    </div>
  );
}
