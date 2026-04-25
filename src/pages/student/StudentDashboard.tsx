import { useState, useMemo } from "react";
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
import { CalendarDays, Clock, Ticket, CheckCircle2, ArrowRight, HelpCircle, AlertTriangle, ScanLine } from "lucide-react";
import PushNotificationPrompt from "@/components/PushNotificationPrompt";
import EventsCalendar from "@/components/student/EventsCalendar";
import type { Tables } from "@/integrations/supabase/types";
import { formatHoursVsRequired } from "@/lib/hours-format";

type Session = Tables<"program_sessions">;
type Event = Tables<"events">;

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
      const results: Record<string, { reserved_hours: number; validated_hours: number; max_hours: number; required_hours: number; cap_hours: number | null }> = {};
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

  // Fetch assistant assignments
  const { data: assistantAssignments = [] } = useQuery({
    queryKey: ["dashboard_assistant_assignments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_student_assistants")
        .select("*, events:event_id(*)")
        .eq("student_id", user!.id);
      if (error) throw error;
      return data as any[];
    },
    enabled: !!user,
  });

  // Student's class for eligibility filtering on the calendar
  const { data: studentClass } = useQuery({
    queryKey: ["dashboard_my_class", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_class_assignments")
        .select("class_id, classes(id, grade_number)")
        .eq("student_id", user!.id)
        .maybeSingle();
      if (error) throw error;
      return data as { class_id: string; classes: { id: string; grade_number: number } | null } | null;
    },
    enabled: !!user,
  });

  // All published, non-public events (same source as Events page)
  const { data: allEvents = [] } = useQuery({
    queryKey: ["dashboard_calendar_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("status", "published")
        .eq("published", true)
        .eq("is_public", false)
        .order("date", { ascending: true });
      if (error) throw error;
      return data as Event[];
    },
  });

  // All my reservations (any status) for marking calendar
  const { data: myReservationsAll = [] } = useQuery({
    queryKey: ["dashboard_my_reservations_all", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("event_id, status")
        .eq("student_id", user!.id)
        .eq("status", "reserved");
      if (error) throw error;
      return data as { event_id: string; status: string }[];
    },
    enabled: !!user,
  });

  // Filter events to those the student is eligible for OR has reserved
  const calendarEvents = useMemo(() => {
    const reservedSet = new Set(myReservationsAll.map((r) => r.event_id));
    const classId = studentClass?.class_id;
    const grade = studentClass?.classes?.grade_number;
    return allEvents.filter((e) => {
      if (reservedSet.has(e.id)) return true;
      const eligibleClasses = (e.eligible_classes as string[] | null) || [];
      const eligibleGrades = (e.eligible_grades as number[] | null) || [];
      const noRestriction = eligibleClasses.length === 0 && eligibleGrades.length === 0;
      if (noRestriction) return true;
      if (classId && eligibleClasses.includes(classId)) return true;
      if (grade !== undefined && grade !== null && eligibleGrades.includes(grade)) return true;
      return false;
    });
  }, [allEvents, myReservationsAll, studentClass]);

  const myReservedIdSet = useMemo(
    () => new Set(myReservationsAll.map((r) => r.event_id)),
    [myReservationsAll],
  );

  // Reservation counts for the calendar events
  const { data: calendarReservationCounts = {} } = useQuery({
    queryKey: ["dashboard_calendar_counts", calendarEvents.map((e) => e.id).join(",")],
    queryFn: async () => {
      const ids = calendarEvents.map((e) => e.id);
      if (ids.length === 0) return {};
      const { data, error } = await supabase.rpc("get_events_reserved_counts", { _event_ids: ids });
      if (error) throw error;
      return (data as Record<string, number>) || {};
    },
    enabled: calendarEvents.length > 0,
  });

  return (
    <div className="space-y-6">
      <PushNotificationPrompt />
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">
            Salut, {profile?.first_name || "Elev"}! 👋
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Urmărește-ți progresul și rezervările.
          </p>
        </div>
        <Button variant="ghost" size="icon" onClick={() => setInfoOpen(true)} className="text-muted-foreground">
          <HelpCircle className="h-5 w-5" />
        </Button>
      </div>

      <Dialog open={infoOpen} onOpenChange={setInfoOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Despre aplicație</DialogTitle>
            <DialogDescription>
              Platforma CNCV îți permite să explorezi și să rezervi locuri la evenimentele extracurriculare organizate de liceu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 text-sm">
            <div>
              <p className="font-semibold mb-1">Cum funcționează?</p>
              <ol className="list-decimal list-inside space-y-1 text-muted-foreground">
                <li>Explorează evenimentele disponibile</li>
                <li>Rezervă-ți un loc</li>
                <li>Participă la eveniment</li>
                <li>Prezența va fi validată la sosire</li>
                <li>Dacă nu poți participa, este obligatoriu să anulezi rezervarea cu cel puțin 2 ore înainte</li>
              </ol>
            </div>
            <div className="rounded-lg border border-destructive/30 bg-destructive/5 p-3">
              <div className="flex gap-2">
                <AlertTriangle className="h-5 w-5 text-destructive shrink-0 mt-0.5" />
                <div>
                  <p className="font-semibold text-destructive">Important!</p>
                  <p className="text-muted-foreground mt-1">
                    Nu poți participa la un eveniment în timpul orelor de curs fără acordul profesorului. Dacă ai făcut o rezervare și nu ai obținut acordul, trebuie să anulezi rezervarea din secțiunea „Biletele mele".
                  </p>
                </div>
              </div>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Progress per session */}
      {activeSessions.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Nu există sesiuni active momentan.
          </CardContent>
        </Card>
      ) : (
        activeSessions.map((s) => {
          const p = progressMap[s.id] || { reserved_hours: 0, validated_hours: 0, max_hours: 0, required_hours: 0, cap_hours: null };
          const requiredH = p.required_hours || p.max_hours || 0;
          const capH = p.cap_hours as number | null;
          const hasCapLimit = capH !== null && capH !== undefined && capH > 0;
          const isComplete = p.validated_hours >= requiredH && requiredH > 0;

          // For progress bars, use cap_hours if set, otherwise required_hours
          const barMax = hasCapLimit ? capH : (requiredH > 0 ? requiredH : null);
          const reservedPct = barMax ? Math.min((p.reserved_hours / barMax) * 100, 100) : 0;
          const validatedPct = barMax ? Math.min((p.validated_hours / barMax) * 100, 100) : 0;

          // Remaining hours based on cap (if set), otherwise unlimited
          const remaining = hasCapLimit ? Math.max(capH - p.reserved_hours, 0) : null;

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
                    <p className="text-lg font-bold">{formatHoursVsRequired(p.reserved_hours, requiredH)}</p>
                    <p className="text-xs text-muted-foreground">Ore rezervate</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <CheckCircle2 className="mx-auto mb-1 h-5 w-5 text-accent" />
                    <p className="text-lg font-bold">{formatHoursVsRequired(p.validated_hours, requiredH)}</p>
                    <p className="text-xs text-muted-foreground">Ore validate</p>
                  </div>
                  <div className="rounded-lg bg-muted p-3">
                    <Clock className="mx-auto mb-1 h-5 w-5 text-muted-foreground" />
                    <p className="text-lg font-bold">{remaining !== null ? remaining : "∞"}</p>
                    <p className="text-xs text-muted-foreground">Ore rămase</p>
                  </div>
                </div>

                {/* Target info */}
                <div className="flex flex-wrap gap-2 text-xs text-muted-foreground">
                  <span>Obiectiv: {requiredH === 0 ? "∞ (fără limită)" : `${requiredH}h`}</span>
                  <span>•</span>
                  <span>Maxim: {hasCapLimit ? `${capH}h` : "Nelimitat"}</span>
                </div>

                {barMax && barMax > 0 && (
                  <div className="space-y-1.5">
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progres validat</span>
                      <span>{p.validated_hours} / {requiredH > 0 ? `${requiredH}h` : "∞"}</span>
                    </div>
                    <Progress value={validatedPct} className="h-2" />
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>Progres rezervat</span>
                      <span>{p.reserved_hours} / {hasCapLimit ? `${capH}h` : (requiredH > 0 ? `${requiredH}h` : "∞")}</span>
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
        {upcomingTickets.length === 0 && assistantAssignments.length === 0 ? (
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
          <>
            {assistantAssignments.map((a: any) => (
              <Card
                key={`assist-${a.id}`}
                className="cursor-pointer hover:bg-muted/50 transition-colors"
                onClick={() => navigate(`/student/events/${a.event_id}`)}
              >
              <CardContent className="flex flex-col gap-2 p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-medium">{a.events?.title}</p>
                      <Badge className="bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200 text-[10px]">Asistent</Badge>
                    </div>
                    <Badge variant="secondary" className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 shrink-0">Prezent</Badge>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-sm text-muted-foreground">
                      {formatDate(a.events?.date)} • {a.events?.start_time?.slice(0, 5)} – {a.events?.end_time?.slice(0, 5)}
                    </p>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={(e) => { e.stopPropagation(); navigate(`/student/scan/${a.event_id}`); }}
                    >
                      <ScanLine className="mr-1 h-3 w-3" /> Scanează
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
            {upcomingTickets.map((r) => (
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
            ))}
          </>
        )}
      </div>

      <Button className="w-full" onClick={() => navigate("/student/events")}>
        <CalendarDays className="mr-2 h-4 w-4" /> Explorează evenimente
      </Button>
    </div>
  );
}
