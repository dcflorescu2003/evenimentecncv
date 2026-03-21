import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown } from "lucide-react";
import { exportReportPdf } from "@/lib/report-pdf";
import { useSearchParams, useNavigate } from "react-router-dom";

export default function TeacherReportPage() {
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(searchParams.get("id") || "");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) setSelectedId(id);
  }, [searchParams]);

  // Get all teachers
  const { data: teachers } = useQuery({
    queryKey: ["mgr-teachers"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["teacher", "homeroom_teacher", "coordinator_teacher"]);
      const ids = [...new Set((roles || []).map((r) => r.user_id))];
      if (!ids.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, display_name").in("id", ids);
      return (profiles || []).sort((a, b) => (a.display_name || a.last_name).localeCompare(b.display_name || b.last_name));
    },
  });

  const filteredTeachers = (teachers || []).filter((t) => {
    if (!search) return true;
    const name = (t.display_name || `${t.last_name} ${t.first_name}`).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  // Summary for all teachers
  const { data: summary } = useQuery({
    queryKey: ["mgr-teacher-summary"],
    enabled: !!teachers?.length,
    queryFn: async () => {
      const teacherIds = (teachers || []).map((t) => t.id);
      const { data: coords } = await supabase.from("coordinator_assignments").select("teacher_id, event_id").in("teacher_id", teacherIds);

      const coordsByTeacher: Record<string, string[]> = {};
      (coords || []).forEach((c) => {
        if (!coordsByTeacher[c.teacher_id]) coordsByTeacher[c.teacher_id] = [];
        coordsByTeacher[c.teacher_id].push(c.event_id);
      });

      const allEventIds = [...new Set((coords || []).map((c) => c.event_id))];
      const { data: events } = allEventIds.length
        ? await supabase.from("events").select("id, counted_duration_hours").in("id", allEventIds)
        : { data: [] };
      const eventHoursMap = Object.fromEntries((events || []).map((e) => [e.id, e.counted_duration_hours]));

      return teacherIds.reduce<Record<string, { events: number; hours: number }>>((acc, id) => {
        const evts = coordsByTeacher[id] || [];
        acc[id] = { events: evts.length, hours: evts.reduce((s, eid) => s + (eventHoursMap[eid] || 0), 0) };
        return acc;
      }, {});
    },
  });

  // Detail for selected teacher
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["mgr-teacher-detail", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("id, first_name, last_name, display_name").eq("id", selectedId).single();
      const { data: coords } = await supabase.from("coordinator_assignments").select("event_id").eq("teacher_id", selectedId);
      const eventIds = (coords || []).map((c) => c.event_id);
      if (!eventIds.length) return { profile, events: [] };

      const { data: events } = await supabase.from("events").select("id, title, date, start_time, end_time, counted_duration_hours, status").in("id", eventIds).order("date");

      // Get participant counts
      const { data: reservations } = await supabase.from("reservations").select("event_id").eq("status", "reserved").in("event_id", eventIds);
      const countMap: Record<string, number> = {};
      (reservations || []).forEach((r) => { countMap[r.event_id] = (countMap[r.event_id] || 0) + 1; });

      return {
        profile,
        events: (events || []).map((e) => ({ ...e, participants: countMap[e.id] || 0 })),
      };
    },
  });

  const handleExportSummary = () => {
    if (!filteredTeachers.length || !summary) return;
    exportReportPdf({
      title: "Raport profesori",
      headers: ["Nr.", "Profesor", "Nr. evenimente", "Ore totale"],
      rows: filteredTeachers.map((t, i) => [
        String(i + 1), t.display_name || `${t.last_name} ${t.first_name}`,
        String(summary[t.id]?.events || 0), String(summary[t.id]?.hours || 0),
      ]),
      filename: "raport-profesori",
    });
  };

  const handleExportDetail = () => {
    if (!detail?.events.length) return;
    const name = detail.profile?.display_name || `${detail.profile?.last_name} ${detail.profile?.first_name}`;
    exportReportPdf({
      title: `Raport profesor: ${name}`,
      headers: ["Nr.", "Data", "Eveniment", "Interval", "Ore", "Participanți", "Status"],
      rows: detail.events.map((e, i) => [
        String(i + 1), e.date, e.title, `${e.start_time?.slice(0, 5)} - ${e.end_time?.slice(0, 5)}`,
        String(e.counted_duration_hours), String(e.participants), e.status,
      ]),
      filename: `raport-profesor-${name}`,
      orientation: "landscape",
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Raport pe profesori</h1>
        <div className="flex gap-2">
          {!selectedId && filteredTeachers.length ? <Button variant="outline" onClick={handleExportSummary}><FileDown className="mr-2 h-4 w-4" />Export PDF</Button> : null}
          {selectedId && detail?.events.length ? <Button variant="outline" onClick={handleExportDetail}><FileDown className="mr-2 h-4 w-4" />Export PDF</Button> : null}
        </div>
      </div>

      <div className="flex gap-4">
        <Input placeholder="Caută profesor..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-80" />
        {selectedId && <Button variant="ghost" onClick={() => setSelectedId("")}>← Înapoi la listă</Button>}
      </div>

      {!selectedId ? (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-12">Nr.</TableHead>
              <TableHead>Profesor</TableHead>
              <TableHead>Nr. evenimente</TableHead>
              <TableHead>Ore totale</TableHead>
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTeachers.map((t, i) => (
              <TableRow key={t.id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>{t.display_name || `${t.last_name} ${t.first_name}`}</TableCell>
                <TableCell>{summary?.[t.id]?.events || 0}</TableCell>
                <TableCell>{summary?.[t.id]?.hours || 0}h</TableCell>
                <TableCell><Button variant="link" size="sm" onClick={() => setSelectedId(t.id)}>Detalii</Button></TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      ) : (
        <>
          {detailLoading && <p className="text-muted-foreground">Se încarcă...</p>}
          {detail && (
            <>
              <div className="grid gap-4 md:grid-cols-3">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Profesor</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{detail.profile?.display_name || `${detail.profile?.last_name} ${detail.profile?.first_name}`}</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Nr. evenimente</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{detail.events.length}</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Ore totale</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{detail.events.reduce((s, e) => s + e.counted_duration_hours, 0)}h</p></CardContent></Card>
              </div>

              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead className="w-12">Nr.</TableHead>
                    <TableHead>Data</TableHead>
                    <TableHead>Eveniment</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead>Ore</TableHead>
                    <TableHead>Participanți</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {detail.events.map((e, i) => (
                    <TableRow key={e.id}>
                      <TableCell>{i + 1}</TableCell>
                      <TableCell>{e.date}</TableCell>
                      <TableCell>{e.title}</TableCell>
                      <TableCell>{e.start_time?.slice(0, 5)} - {e.end_time?.slice(0, 5)}</TableCell>
                      <TableCell>{e.counted_duration_hours}h</TableCell>
                      <TableCell>{e.participants}</TableCell>
                      <TableCell>{e.status}</TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </>
          )}
        </>
      )}
    </div>
  );
}
