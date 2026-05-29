import { useQuery } from "@tanstack/react-query";
import { useNavigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import EventsCalendar, { type VolunteerDayItem } from "@/components/student/EventsCalendar";
import type { Tables } from "@/integrations/supabase/types";

type Event = Tables<"events">;

const EMPTY_RESERVED = new Set<string>();

export default function AllEventsCalendarSection() {
  const navigate = useNavigate();
  const location = useLocation();
  // Determine the route prefix based on which layout the user is on
  const prefix = location.pathname.startsWith("/teacher") ? "/teacher" : "/prof";

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

  const { data: volunteerDays = [] } = useQuery<VolunteerDayItem[]>({
    queryKey: ["all_volunteer_days_calendar"],
    queryFn: async () => {
      const { data: projects, error: pErr } = await supabase
        .from("volunteer_projects")
        .select("id, name")
        .eq("status", "active");
      if (pErr) throw pErr;
      if (!projects || projects.length === 0) return [];
      const ids = projects.map((p) => p.id);
      const { data: days, error: dErr } = await supabase
        .from("volunteer_days")
        .select("id, project_id, date, start_time, end_time, location")
        .in("project_id", ids)
        .order("date", { ascending: true });
      if (dErr) throw dErr;
      const nameById = new Map(projects.map((p) => [p.id, p.name]));
      return (days ?? []).map((d: any) => ({
        id: d.id,
        project_id: d.project_id,
        project_name: nameById.get(d.project_id) ?? "Proiect",
        date: d.date,
        start_time: d.start_time,
        end_time: d.end_time,
        location: d.location,
      }));
    },
  });

  return (
    <EventsCalendar
      events={events}
      myReservationIds={EMPTY_RESERVED}
      reservationCounts={counts}
      volunteerDays={volunteerDays}
      onEventClick={(ev) => navigate(`${prefix}/events/preview/${ev.id}`)}
      onVolunteerClick={(v) => navigate(`${prefix}/volunteer/preview/${v.project_id}`)}
    />
  );
}
