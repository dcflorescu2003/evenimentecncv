import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileDown } from "lucide-react";
import { exportReportPdf } from "@/lib/report-pdf";
import { useNavigate } from "react-router-dom";

export default function DayReportPage() {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const navigate = useNavigate();

  const { data: events, isLoading } = useQuery({
    queryKey: ["mgr-day", date],
    enabled: !!date,
    queryFn: async () => {
      const { data } = await supabase
        .from("events")
        .select("id, title, start_time, end_time, counted_duration_hours, max_capacity, status")
        .eq("date", date)
        .order("start_time");
      if (!data?.length) return [];

      const eventIds = data.map((e) => e.id);
      const [coordsRes, reservationsRes] = await Promise.all([
        supabase.from("coordinator_assignments").select("event_id, teacher_id").in("event_id", eventIds),
        supabase.from("reservations").select("event_id").eq("status", "reserved").in("event_id", eventIds),
      ]);

      const teacherIds = [...new Set((coordsRes.data || []).map((c) => c.teacher_id))];
      const { data: profiles } = teacherIds.length
        ? await supabase.from("profiles").select("id, first_name, last_name, display_name").in("id", teacherIds)
        : { data: [] };

      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.display_name || `${p.last_name} ${p.first_name}`]));
      const reservedCounts: Record<string, number> = {};
      (reservationsRes.data || []).forEach((r) => { reservedCounts[r.event_id] = (reservedCounts[r.event_id] || 0) + 1; });

      return data.map((e) => ({
        ...e,
        enrolled: reservedCounts[e.id] || 0,
        coordinators: (coordsRes.data || []).filter((c) => c.event_id === e.id).map((c) => ({ id: c.teacher_id, name: profileMap[c.teacher_id] || "" })),
      }));
    },
  });

  const handleExport = () => {
    if (!events?.length) return;
    exportReportPdf({
      title: "Raport pe zi",
      subtitle: new Date(date + "T00:00:00").toLocaleDateString("ro-RO", { weekday: "long", day: "numeric", month: "long", year: "numeric" }),
      headers: ["Interval", "Eveniment", "Durata", "Înscriși", "Capacitate", "Profesori"],
      rows: events.map((e) => [
        `${e.start_time?.slice(0, 5)} - ${e.end_time?.slice(0, 5)}`, e.title, `${e.counted_duration_hours}h`,
        String(e.enrolled), String(e.max_capacity),
        e.coordinators.map((c: any) => c.name).join(", "),
      ]),
      filename: `raport-zi-${date}`,
      orientation: "landscape",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Raport pe zile</h1>
        {events?.length ? <Button variant="outline" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" />Export PDF</Button> : null}
      </div>

      <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="w-56" />

      {isLoading && <p className="text-muted-foreground">Se încarcă...</p>}

      {events?.length ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Interval</TableHead>
              <TableHead>Eveniment</TableHead>
              <TableHead>Durata</TableHead>
              <TableHead>Înscriși</TableHead>
              <TableHead>Capacitate</TableHead>
              <TableHead>Profesori coordonatori</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {events.map((e) => (
              <TableRow key={e.id}>
                <TableCell>{e.start_time?.slice(0, 5)} - {e.end_time?.slice(0, 5)}</TableCell>
                <TableCell>{e.title}</TableCell>
                <TableCell>{e.counted_duration_hours}h</TableCell>
                <TableCell>{e.enrolled}</TableCell>
                <TableCell>{e.max_capacity}</TableCell>
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
      ) : !isLoading ? (
        <p className="text-muted-foreground">Nu sunt evenimente în această zi.</p>
      ) : null}
    </div>
  );
}
