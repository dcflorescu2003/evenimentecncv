import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import EventsCalendar from "@/components/student/EventsCalendar";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { CalendarDays, Clock, MapPin, Users } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { formatDate } from "@/lib/time";

type Event = Tables<"events">;

const EMPTY_RESERVED = new Set<string>();

export default function AllEventsCalendarSection() {
  const [selected, setSelected] = useState<Event | null>(null);

  const { data: events = [] } = useQuery({
    queryKey: ["all_published_events_calendar"],
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

  const { data: counts = {} } = useQuery({
    queryKey: ["all_published_events_counts", events.map(e => e.id).join(",")],
    queryFn: async () => {
      const ids = events.map(e => e.id);
      if (ids.length === 0) return {};
      const { data, error } = await supabase.rpc("get_events_reserved_counts", { _event_ids: ids });
      if (error) throw error;
      return (data as Record<string, number>) || {};
    },
    enabled: events.length > 0,
  });

  const reserved = counts[selected?.id || ""] || 0;

  return (
    <>
      <EventsCalendar
        events={events}
        myReservationIds={EMPTY_RESERVED}
        reservationCounts={counts}
        onEventClick={(ev) => setSelected(ev)}
      />

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{selected?.title}</DialogTitle>
            {selected?.description && (
              <DialogDescription className="whitespace-pre-wrap">
                {selected.description}
              </DialogDescription>
            )}
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <CalendarDays className="h-4 w-4" />
                <span>{formatDate(selected.date)}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>{selected.start_time?.slice(0, 5)} – {selected.end_time?.slice(0, 5)}</span>
                <Badge variant="outline" className="ml-1">{selected.counted_duration_hours}h</Badge>
              </div>
              {selected.location && (
                <div className="flex items-center gap-2 text-muted-foreground">
                  <MapPin className="h-4 w-4" />
                  <span>{selected.location}{selected.room_details ? ` • ${selected.room_details}` : ""}</span>
                </div>
              )}
              <div className="flex items-center gap-2 text-muted-foreground">
                <Users className="h-4 w-4" />
                <span>{reserved} / {selected.max_capacity} locuri rezervate</span>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
