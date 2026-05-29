import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { ArrowLeft, CalendarDays, Clock, MapPin, Users, Eye } from "lucide-react";
import { formatDate } from "@/lib/time";
import { CseBadge } from "@/components/CseBadge";
import type { Tables } from "@/integrations/supabase/types";

type Event = Tables<"events">;

export default function EventPreviewPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();

  const { data: event, isLoading } = useQuery({
    queryKey: ["event_preview", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", id!).single();
      if (error) throw error;
      return data as Event;
    },
    enabled: !!id,
  });

  const { data: session } = useQuery({
    queryKey: ["event_preview_session", event?.session_id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_sessions")
        .select("name")
        .eq("id", event!.session_id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
    enabled: !!event?.session_id,
  });

  const { data: counts = {} } = useQuery({
    queryKey: ["event_preview_count", id],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_events_reserved_counts", { _event_ids: [id!] });
      if (error) throw error;
      return (data as Record<string, number>) || {};
    },
    enabled: !!id,
  });

  if (isLoading) {
    return <div className="flex items-center justify-center py-12 text-muted-foreground">Se încarcă…</div>;
  }
  if (!event) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" onClick={() => navigate(-1)}>
          <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi
        </Button>
        <p className="text-muted-foreground">Evenimentul nu a fost găsit.</p>
      </div>
    );
  }

  const reserved = counts[event.id] || 0;
  const spotsLeft = Math.max(0, event.max_capacity - reserved);

  return (
    <div className="space-y-5">
      <Button variant="ghost" size="sm" onClick={() => navigate(-1)}>
        <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi
      </Button>

      <div>
        <div className="flex items-center gap-2 flex-wrap">
          <h1 className="font-display text-xl font-bold">{event.title}</h1>
          {event.is_cse && <CseBadge short />}
          <Badge variant="outline" className="gap-1 text-xs">
            <Eye className="h-3 w-3" /> Vizualizare
          </Badge>
        </div>
        {session && <p className="text-sm text-muted-foreground">{session.name}</p>}
      </div>

      <div className="flex flex-wrap gap-2">
        <Badge variant="outline" className="gap-1">
          <CalendarDays className="h-3 w-3" /> {formatDate(event.date)}
        </Badge>
        <Badge variant="outline" className="gap-1">
          <Clock className="h-3 w-3" /> {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)} ({event.counted_duration_hours}h)
        </Badge>
        {event.location && (
          <Badge variant="outline" className="gap-1">
            <MapPin className="h-3 w-3" /> {event.location}
            {event.room_details ? ` • ${event.room_details}` : ""}
          </Badge>
        )}
        <Badge variant="outline" className="gap-1">
          <Users className="h-3 w-3" /> {reserved} / {event.max_capacity} locuri rezervate ({spotsLeft} libere)
        </Badge>
      </div>

      {(event.booking_open_at || event.booking_close_at) && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-1">Perioada de înscriere</p>
            <p className="text-sm text-muted-foreground">
              {event.booking_open_at && (
                <>De la: {new Date(event.booking_open_at).toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</>
              )}
              {event.booking_open_at && event.booking_close_at && " — "}
              {event.booking_close_at && (
                <>Până la: {new Date(event.booking_close_at).toLocaleString("ro-RO", { day: "2-digit", month: "2-digit", year: "numeric", hour: "2-digit", minute: "2-digit" })}</>
              )}
            </p>
          </CardContent>
        </Card>
      )}

      {event.description && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm whitespace-pre-wrap">{event.description}</p>
          </CardContent>
        </Card>
      )}

      {event.notes_for_teachers && (
        <Card>
          <CardContent className="p-4">
            <p className="text-sm font-medium mb-1">Notițe pentru profesori</p>
            <p className="text-sm text-muted-foreground whitespace-pre-wrap">{event.notes_for_teachers}</p>
          </CardContent>
        </Card>
      )}

      <p className="text-xs text-muted-foreground italic">
        Vizualizare informativă. Înscrierile sunt disponibile doar pentru elevi.
      </p>
    </div>
  );
}
