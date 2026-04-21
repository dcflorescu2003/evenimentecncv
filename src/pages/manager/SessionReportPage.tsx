import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown } from "lucide-react";
import { exportReportPdf } from "@/lib/report-pdf";
import { useNavigate } from "react-router-dom";
import { useManagerSession } from "@/components/layouts/ManagerLayout";

export default function SessionReportPage() {
  const { sessionId, sessionName } = useManagerSession();
  const navigate = useNavigate();

  const { data: events, isLoading } = useQuery({
    queryKey: ["manager-session-events", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, date, start_time, end_time, counted_duration_hours, status")
        .eq("session_id", sessionId)
        .order("date")
        .order("start_time");
      if (!data) return [];

      const eventIds = data.map((e) => e.id);
      const { data: coords } = await supabase.from("coordinator_assignments").select("event_id, teacher_id").in("event_id", eventIds);
      const teacherIds = [...new Set((coords || []).map((c) => c.teacher_id))];
      const { data: profiles } = teacherIds.length
        ? await supabase.from("profiles").select("id, first_name, last_name, display_name").in("id", teacherIds)
        : { data: [] };
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, `${p.last_name} ${p.first_name}`]));

      return data.map((e) => ({
        ...e,
        coordinators: (coords || []).filter((c) => c.event_id === e.id).map((c) => ({ id: c.teacher_id, name: profileMap[c.teacher_id] || "" })),
      }));
    },
  });

  const grouped = (events || []).reduce<Record<string, typeof events>>((acc, e) => {
    const d = e.date;
    if (!acc[d]) acc[d] = [];
    acc[d]!.push(e);
    return acc;
  }, {});

  const handleExport = () => {
    if (!events?.length) return;
    exportReportPdf({
      title: "Raport sesiune", subtitle: sessionName,
      headers: ["Data", "Interval orar", "Eveniment", "Durata (h)", "Status", "Profesori coordonatori"],
      rows: events.map((e) => [
        e.date, `${e.start_time?.slice(0, 5)} - ${e.end_time?.slice(0, 5)}`, e.title,
        String(e.counted_duration_hours), e.status, e.coordinators.map((c: any) => c.name).join(", "),
      ]),
      filename: `raport-sesiune-${sessionName}`, orientation: "landscape",
    });
  };

  if (!sessionId) return <p className="text-muted-foreground">Selectează o sesiune din meniul lateral.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">Raport pe sesiune</h1>
        {events?.length ? <Button variant="outline" onClick={handleExport} className="w-full sm:w-auto"><FileDown className="mr-2 h-4 w-4" />Export PDF</Button> : null}
      </div>

      {isLoading && <p className="text-muted-foreground">Se încarcă...</p>}

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
                    <TableCell>{e.status}</TableCell>
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
                <p className="text-xs text-muted-foreground">{e.start_time?.slice(0, 5)} - {e.end_time?.slice(0, 5)} · {e.status}</p>
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
}
