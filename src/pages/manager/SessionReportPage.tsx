import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown } from "lucide-react";
import { exportReportPdfSections } from "@/lib/report-pdf";
import { useNavigate } from "react-router-dom";
import { useManagerSession } from "@/components/layouts/ManagerLayout";

const STATUS_LABEL: Record<string, string> = {
  draft: "Ciornă",
  published: "Deschis",
  closed: "Finalizat",
  cancelled: "Anulat",
};
const statusLabel = (s: string) => STATUS_LABEL[s] || s;

export default function SessionReportPage() {
  const { sessionId, sessionName } = useManagerSession();
  const navigate = useNavigate();

  const { data: events, isLoading } = useQuery({
    queryKey: ["manager-session-events", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, date, start_time, end_time, counted_duration_hours, status, is_cse")
        .eq("session_id", sessionId)
        .neq("status", "draft")
        .order("date")
        .order("start_time");
      if (!data) return [];

      const eventIds = data.map((e) => e.id);
      const [coordsRes, resRes, pubRes, profilesPre] = await Promise.all([
        supabase.from("coordinator_assignments").select("event_id, teacher_id").in("event_id", eventIds),
        supabase.from("reservations").select("event_id").in("event_id", eventIds).eq("status", "reserved"),
        supabase.from("public_reservations").select("event_id").in("event_id", eventIds).eq("status", "reserved"),
        Promise.resolve(null),
      ]);
      const coords = coordsRes.data || [];
      const teacherIds = [...new Set(coords.map((c) => c.teacher_id))];
      const { data: profiles } = teacherIds.length
        ? await supabase.from("profiles").select("id, first_name, last_name, display_name").in("id", teacherIds)
        : { data: [] };
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, `${p.last_name} ${p.first_name}`]));

      const countMap: Record<string, number> = {};
      (resRes.data || []).forEach((r) => { countMap[r.event_id] = (countMap[r.event_id] || 0) + 1; });
      (pubRes.data || []).forEach((r) => { countMap[r.event_id] = (countMap[r.event_id] || 0) + 1; });

      return data.map((e) => ({
        ...e,
        participants: countMap[e.id] || 0,
        coordinators: coords.filter((c) => c.event_id === e.id).map((c) => ({ id: c.teacher_id, name: profileMap[c.teacher_id] || "" })),
      }));
    },
  });

  const cseEvents = (events || []).filter((e) => e.is_cse);
  const profEvents = (events || []).filter((e) => !e.is_cse);

  const groupByDate = (list: typeof events) => (list || []).reduce<Record<string, typeof events>>((acc, e) => {
    if (!acc[e.date]) acc[e.date] = [];
    acc[e.date]!.push(e);
    return acc;
  }, {});

  const handleExport = () => {
    if (!events?.length) return;
    const headers = ["Nr.", "Data", "Interval orar", "Eveniment", "Durata (h)", "Participanți", "Status", "Profesori coordonatori"];
    const buildRows = (list: typeof events) =>
      (list || []).map((e, i) => [
        String(i + 1),
        e.date,
        `${e.start_time?.slice(0, 5)} - ${e.end_time?.slice(0, 5)}`,
        e.title,
        String(e.counted_duration_hours),
        String(e.participants),
        statusLabel(e.status),
        e.coordinators.map((c: any) => c.name).join(", "),
      ]);

    exportReportPdfSections({
      title: "Raport sesiune",
      subtitle: sessionName,
      filename: `raport-sesiune-${sessionName}`,
      orientation: "landscape",
      sections: [
        { title: "Evenimente organizate de profesori", headers, rows: buildRows(profEvents) },
        { title: "Evenimente CSE", headers, rows: buildRows(cseEvents) },
      ],
    });
  };

  if (!sessionId) return <p className="text-muted-foreground">Selectează o sesiune din meniul lateral.</p>;

  const renderSection = (title: string, list: typeof events) => {
    if (!list || !list.length) return null;
    const grouped = groupByDate(list);
    return (
      <div className="space-y-4">
        <h2 className="text-lg sm:text-xl font-bold border-b pb-1">{title}</h2>
        {Object.entries(grouped).map(([date, dayEvents]) => (
          <div key={date} className="space-y-2">
            <h3 className="font-semibold text-base sm:text-lg break-words">{new Date(date + "T00:00:00").toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}</h3>
            {/* Desktop */}
            <div className="hidden md:block overflow-x-auto overscroll-x-contain rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Interval</TableHead>
                    <TableHead>Eveniment</TableHead>
                    <TableHead>Durata</TableHead>
                    <TableHead>Participanți</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Profesori coordonatori</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {(dayEvents || []).map((e: any) => (
                    <TableRow key={e.id}>
                      <TableCell>{e.start_time?.slice(0, 5)} - {e.end_time?.slice(0, 5)}</TableCell>
                      <TableCell>{e.title}</TableCell>
                      <TableCell>{e.counted_duration_hours}h</TableCell>
                      <TableCell>{e.participants}</TableCell>
                      <TableCell>{statusLabel(e.status)}</TableCell>
                      <TableCell>
                        {e.coordinators.map((c: any, i: number) => (
                          <span key={c.id}>
                            <button className="text-primary underline hover:no-underline" onClick={() => navigate(`/manager/teachers?id=${c.id}`)}>{c.name}</button>
                            {i < e.coordinators.length - 1 ? ", " : ""}
                          </span>
                        ))}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
            {/* Mobile */}
            <div className="md:hidden space-y-2">
              {(dayEvents || []).map((e: any) => (
                <div key={e.id} className="rounded-lg border bg-card p-3 space-y-1">
                  <div className="flex items-start justify-between gap-2">
                    <p className="font-medium min-w-0 flex-1 break-words">{e.title}</p>
                    <Badge variant="secondary" className="shrink-0">{e.counted_duration_hours}h</Badge>
                  </div>
                  <p className="text-xs text-muted-foreground">{e.start_time?.slice(0, 5)} - {e.end_time?.slice(0, 5)} · {statusLabel(e.status)} · {e.participants} participanți</p>
                  {e.coordinators.length > 0 && (
                    <p className="text-xs">
                      {e.coordinators.map((c: any, i: number) => (
                        <span key={c.id}>
                          <button className="text-primary underline hover:no-underline" onClick={() => navigate(`/manager/teachers?id=${c.id}`)}>{c.name}</button>
                          {i < e.coordinators.length - 1 ? ", " : ""}
                        </span>
                      ))}
                    </p>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">Raport pe sesiune</h1>
        {events?.length ? <Button variant="outline" onClick={handleExport} className="w-full sm:w-auto"><FileDown className="mr-2 h-4 w-4" />Export PDF</Button> : null}
      </div>

      {isLoading && <p className="text-muted-foreground">Se încarcă...</p>}

      {renderSection("Evenimente organizate de profesori", profEvents)}
      {renderSection("Evenimente CSE", cseEvents)}
    </div>
  );
}
