import { useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, MapPin, ScanLine, Users } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";

type Assignment = Tables<"coordinator_assignments">;
type Event = Tables<"events">;

export default function CoordinatorDashboard() {
  const { user, profile } = useAuth();
  const navigate = useNavigate();

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["my_coord_assignments", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("coordinator_assignments")
        .select("*, events(*)")
        .eq("teacher_id", user!.id);
      if (error) throw error;
      return data as (Assignment & { events: Event })[];
    },
    enabled: !!user,
  });

  // Count reservations per event
  const eventIds = assignments.map((a) => a.event_id);
  const { data: reservationCounts = {} } = useQuery({
    queryKey: ["coord_reservation_counts", eventIds],
    queryFn: async () => {
      const counts: Record<string, number> = {};
      for (const eid of eventIds) {
        const { count, error } = await supabase
          .from("reservations")
          .select("*", { count: "exact", head: true })
          .eq("event_id", eid)
          .eq("status", "reserved");
        if (!error) counts[eid] = count || 0;
      }
      return counts;
    },
    enabled: eventIds.length > 0,
  });

  const upcoming = assignments
    .filter((a) => a.events?.status === "published")
    .sort((a, b) => (a.events?.date || "").localeCompare(b.events?.date || ""));

  const past = assignments
    .filter((a) => a.events?.status !== "published")
    .sort((a, b) => (b.events?.date || "").localeCompare(a.events?.date || ""));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-bold">
          Bună, {profile?.first_name || "Coordonator"}! 👋
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Evenimentele tale și scanarea prezenței.
        </p>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Se încarcă…</div>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <CalendarDays className="mx-auto mb-2 h-8 w-8" />
            <p>Nu ai evenimente atribuite momentan.</p>
          </CardContent>
        </Card>
      ) : (
        <>
          {upcoming.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold">Evenimente active ({upcoming.length})</h2>
              {upcoming.map((a) => (
                <EventCard
                  key={a.id}
                  assignment={a}
                  count={reservationCounts[a.event_id] || 0}
                  onScan={() => navigate(`/coordinator/scan/${a.event_id}`)}
                  onParticipants={() => navigate(`/coordinator/event/${a.event_id}`)}
                />
              ))}
            </div>
          )}
          {past.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-muted-foreground">Încheiate ({past.length})</h2>
              {past.map((a) => (
                <EventCard
                  key={a.id}
                  assignment={a}
                  count={reservationCounts[a.event_id] || 0}
                  onParticipants={() => navigate(`/coordinator/event/${a.event_id}`)}
                  past
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EventCard({
  assignment,
  count,
  onScan,
  onParticipants,
  past,
}: {
  assignment: Assignment & { events: Event };
  count: number;
  onScan?: () => void;
  onParticipants: () => void;
  past?: boolean;
}) {
  const ev = assignment.events;
  if (!ev) return null;

  return (
    <Card className={past ? "opacity-70" : ""}>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-start justify-between">
          <div>
            <p className="font-medium">{ev.title}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> {ev.date}
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
          <Badge variant="secondary" className="flex items-center gap-1">
            <Users className="h-3 w-3" /> {count}/{ev.max_capacity}
          </Badge>
        </div>
        <div className="flex gap-2">
          {!past && onScan && (
            <Button size="sm" className="flex-1" onClick={onScan}>
              <ScanLine className="mr-2 h-4 w-4" /> Scanează QR
            </Button>
          )}
          <Button variant="outline" size="sm" className={past ? "w-full" : "flex-1"} onClick={onParticipants}>
            <Users className="mr-2 h-4 w-4" /> Participanți
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
