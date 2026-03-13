import { formatDate } from "@/lib/time";
import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Search, CalendarDays, Clock, MapPin, Users, Ticket } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Event = Tables<"events">;

export default function StudentEventsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [filterSession, setFilterSession] = useState("all");
  const [bookingEventId, setBookingEventId] = useState<string | null>(null);
  const [eligibilityMsg, setEligibilityMsg] = useState<string | null>(null);

  const { data: sessions = [] } = useQuery({
    queryKey: ["active_sessions_student"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_sessions")
        .select("*")
        .in("status", ["active"])
        .order("start_date");
      if (error) throw error;
      return data;
    },
  });

  // Get student's class assignment
  const { data: studentClass } = useQuery({
    queryKey: ["my_class", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_class_assignments")
        .select("class_id")
        .eq("student_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  // Get student's class details (grade)
  const { data: classInfo } = useQuery({
    queryKey: ["my_class_info", studentClass?.class_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, grade_number")
        .eq("id", studentClass!.class_id)
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!studentClass?.class_id,
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["published_events"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("status", "published")
        .eq("published", true)
        .order("date", { ascending: true });
      if (error) throw error;
      return data as Event[];
    },
  });

  const { data: myReservations = [] } = useQuery({
    queryKey: ["my_reservations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("event_id, status")
        .eq("student_id", user!.id)
        .eq("status", "reserved");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const reservedEventIds = new Set(myReservations.map((r) => r.event_id));

  // Filter events: only show events the student is eligible for OR already registered
  const filtered = events.filter((e) => {
    // Always show events where student is already registered
    if (reservedEventIds.has(e.id)) {
      // Still apply search/session filters
      if (filterSession !== "all" && e.session_id !== filterSession) return false;
      if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
      return true;
    }

    // Hide events with expired booking window
    if (e.booking_close_at && new Date(e.booking_close_at) < new Date()) {
      return false;
    }

    // Check class/grade eligibility
    const hasClassRestriction = e.eligible_classes && (e.eligible_classes as string[]).length > 0;
    const hasGradeRestriction = e.eligible_grades && (e.eligible_grades as number[]).length > 0;

    if (hasClassRestriction && studentClass?.class_id) {
      if (!(e.eligible_classes as string[]).includes(studentClass.class_id)) return false;
    } else if (hasClassRestriction && !studentClass?.class_id) {
      // Has class restriction but student has no class assigned - not eligible
      return false;
    } else if (hasGradeRestriction && classInfo?.grade_number) {
      if (!(e.eligible_grades as number[]).includes(classInfo.grade_number)) return false;
    } else if (hasGradeRestriction && !classInfo?.grade_number) {
      // Has grade restriction but student has no grade info - not eligible
      return false;
    }

    if (filterSession !== "all" && e.session_id !== filterSession) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const bookMutation = useMutation({
    mutationFn: async (eventId: string) => {
      // Check eligibility first
      const { data: eligibility, error: eligError } = await supabase.rpc("check_booking_eligibility", {
        _student_id: user!.id,
        _event_id: eventId,
      });
      if (eligError) throw new Error(eligError.message);
      const result = eligibility as any;
      if (!result.allowed) {
        throw new Error(result.reason);
      }

      // Check if there's an existing cancelled reservation to reactivate
      const { data: existing } = await supabase
        .from("reservations")
        .select("id")
        .eq("student_id", user!.id)
        .eq("event_id", eventId)
        .eq("status", "cancelled")
        .maybeSingle();

      if (existing) {
        // Reactivate cancelled reservation
        const { error: reactivateError } = await supabase
          .from("reservations")
          .update({ status: "reserved", cancelled_at: null })
          .eq("id", existing.id);
        if (reactivateError) throw new Error(reactivateError.message);

        // Reactivate or create ticket
        const { data: existingTicket } = await supabase
          .from("tickets")
          .select("id")
          .eq("reservation_id", existing.id)
          .maybeSingle();

        if (existingTicket) {
          await supabase
            .from("tickets")
            .update({ status: "reserved", qr_code_data: crypto.randomUUID() })
            .eq("id", existingTicket.id);
        } else {
          const { error: ticketError } = await supabase
            .from("tickets")
            .insert({ reservation_id: existing.id });
          if (ticketError) throw new Error(ticketError.message);
        }
        return existing;
      }

      // Create new reservation
      const { data: reservation, error: resError } = await supabase
        .from("reservations")
        .insert({ student_id: user!.id, event_id: eventId })
        .select()
        .single();
      if (resError) {
        if (resError.message.includes("duplicate key")) {
          throw new Error("Ai deja o rezervare pentru acest eveniment.");
        }
        throw new Error(resError.message);
      }

      // Create ticket
      const { error: ticketError } = await supabase
        .from("tickets")
        .insert({ reservation_id: reservation.id });
      if (ticketError) throw new Error(ticketError.message);

      return reservation;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["my_reservations"] });
      queryClient.invalidateQueries({ queryKey: ["published_events"] });
      queryClient.invalidateQueries({ queryKey: ["student_progress"] });
      queryClient.invalidateQueries({ queryKey: ["all_my_reservations"] });
      toast.success("Rezervare confirmată! Biletul a fost generat.");
      setBookingEventId(null);
    },
    onError: (e: Error) => {
      toast.error(e.message);
      setBookingEventId(null);
    },
  });

  async function handleBookClick(eventId: string) {
    // Pre-check eligibility for user feedback
    const { data, error } = await supabase.rpc("check_booking_eligibility", {
      _student_id: user!.id,
      _event_id: eventId,
    });
    if (error) {
      toast.error(error.message);
      return;
    }
    const result = data as any;
    if (!result.allowed) {
      setEligibilityMsg(result.reason);
      return;
    }
    setBookingEventId(eventId);
  }

  const getSessionName = (id: string) => sessions.find((s) => s.id === id)?.name || "";

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Evenimente disponibile</h1>
        <p className="mt-1 text-sm text-muted-foreground">Rezervă locuri la activitățile disponibile.</p>
      </div>

      {/* Filters */}
      <div className="flex flex-col gap-2 sm:flex-row">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input placeholder="Caută…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
        </div>
        {sessions.length > 1 && (
          <Select value={filterSession} onValueChange={setFilterSession}>
            <SelectTrigger className="w-full sm:w-[180px]">
              <SelectValue placeholder="Sesiune" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">Toate sesiunile</SelectItem>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      {/* Event Cards */}
      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Se încarcă…</div>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <CalendarDays className="mx-auto mb-2 h-8 w-8" />
            <p>Nu sunt evenimente disponibile momentan.</p>
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-3">
          {filtered.map((ev) => {
            const isReserved = reservedEventIds.has(ev.id);
            return (
              <Card
                key={ev.id}
                className="overflow-hidden transition-colors hover:bg-muted/30"
              >
                <CardContent className="p-4 space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1" onClick={() => navigate(`/student/events/${ev.id}`)} role="button">
                      <p className="font-medium">{ev.title}</p>
                      <p className="mt-0.5 text-xs text-muted-foreground">
                        {getSessionName(ev.session_id)}
                      </p>
                    </div>
                    <Badge variant="secondary">{ev.counted_duration_hours}h</Badge>
                  </div>

                  <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
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
                    <span className="flex items-center gap-1">
                      <Users className="h-3 w-3" /> {ev.max_capacity} locuri
                    </span>
                  </div>

                  <div className="flex items-center gap-2">
                    {isReserved ? (
                      <Button variant="secondary" size="sm" disabled className="w-full">
                        <Ticket className="mr-2 h-4 w-4" /> Rezervat
                      </Button>
                    ) : (
                      <Button size="sm" className="w-full" onClick={() => handleBookClick(ev.id)}>
                        <Ticket className="mr-2 h-4 w-4" /> Rezervă loc
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => navigate(`/student/events/${ev.id}`)}>
                      Detalii
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      {/* Booking Confirmation */}
      <AlertDialog open={!!bookingEventId} onOpenChange={(o) => !o && setBookingEventId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmă rezervarea</AlertDialogTitle>
            <AlertDialogDescription>
              Ești sigur că vrei să te înscrii la acest eveniment? Se va genera un bilet cu cod QR.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => bookingEventId && bookMutation.mutate(bookingEventId)}
              disabled={bookMutation.isPending}
            >
              {bookMutation.isPending ? "Se procesează…" : "Confirmă"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Eligibility Error */}
      <AlertDialog open={!!eligibilityMsg} onOpenChange={(o) => !o && setEligibilityMsg(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Nu te poți înscrie</AlertDialogTitle>
            <AlertDialogDescription>{eligibilityMsg}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Am înțeles</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
