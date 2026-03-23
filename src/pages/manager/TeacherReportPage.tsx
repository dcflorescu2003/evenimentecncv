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
import { useManagerSession } from "@/components/layouts/ManagerLayout";

export default function TeacherReportPage() {
  const { sessionId, sessionName } = useManagerSession();
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(searchParams.get("id") || "");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    const id = searchParams.get("id");
    if (id) setSelectedId(id);
  }, [searchParams]);

  const { data: teachers } = useQuery({
    queryKey: ["mgr-teachers"],
    queryFn: async () => {
      const { data: roles } = await supabase.from("user_roles").select("user_id").in("role", ["teacher", "homeroom_teacher", "coordinator_teacher"]);
      const ids = [...new Set((roles || []).map((r) => r.user_id))];
      if (!ids.length) return [];
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, display_name, teaching_norm").in("id", ids);
      return ((profiles as any[]) || []).sort((a, b) => a.last_name.localeCompare(b.last_name));
    },
  });

  const filteredTeachers = (teachers || []).filter((t) => {
    if (!search) return true;
    const name = (t`${t.last_name} ${t.first_name}`).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  // Summary scoped to session
  const { data: summary } = useQuery({
    queryKey: ["mgr-teacher-summary", sessionId],
    enabled: !!teachers?.length && !!sessionId,
    queryFn: async () => {
      const teacherIds = (teachers || []).map((t) => t.id);
      const { data: coords } = await supabase.from("coordinator_assignments").select("teacher_id, event_id").in("teacher_id", teacherIds);
      const allEventIds = [...new Set((coords || []).map((c) => c.event_id))];
      const { data: events } = allEventIds.length
        ? await supabase.from("events").select("id, counted_duration_hours, session_id").in("id", allEventIds)
        : { data: [] };
      
      // Only count events from selected session
      const sessionEvents = (events || []).filter((e) => e.session_id === sessionId);
      const sessionEventIds = new Set(sessionEvents.map((e) => e.id));
      const eventHoursMap = Object.fromEntries(sessionEvents.map((e) => [e.id, e.counted_duration_hours]));

      // Total session hours for "remaining"
      const { data: allSessionEvents } = await supabase.from("events").select("counted_duration_hours").eq("session_id", sessionId);
      const totalSessionHours = (allSessionEvents || []).reduce((s, e) => s + (e.counted_duration_hours || 0), 0);

      const coordsByTeacher: Record<string, string[]> = {};
      (coords || []).forEach((c) => {
        if (sessionEventIds.has(c.event_id)) {
          if (!coordsByTeacher[c.teacher_id]) coordsByTeacher[c.teacher_id] = [];
          coordsByTeacher[c.teacher_id].push(c.event_id);
        }
      });

      return teacherIds.reduce<Record<string, { events: number; hours: number }>>((acc, id) => {
        const evts = coordsByTeacher[id] || [];
        const hours = evts.reduce((s, eid) => s + (eventHoursMap[eid] || 0), 0);
        acc[id] = { events: evts.length, hours };
        return acc;
      }, {});
    },
  });

  // Detail scoped to session
  const { data: detail, isLoading: detailLoading } = useQuery({
    queryKey: ["mgr-teacher-detail", selectedId, sessionId],
    enabled: !!selectedId && !!sessionId,
    queryFn: async () => {
      const { data: profile } = await supabase.from("profiles").select("id, first_name, last_name, display_name, teaching_norm").eq("id", selectedId).single();
      const { data: coords } = await supabase.from("coordinator_assignments").select("event_id").eq("teacher_id", selectedId);
      const eventIds = (coords || []).map((c) => c.event_id);
      if (!eventIds.length) return { profile, events: [], totalHours: 0 };

      const { data: events } = await supabase.from("events").select("id, title, date, start_time, end_time, counted_duration_hours, status, session_id").in("id", eventIds).eq("session_id", sessionId).order("date");

      const sessionEventIds = (events || []).map((e) => e.id);
      const { data: reservations } = sessionEventIds.length ? await supabase.from("reservations").select("event_id").eq("status", "reserved").in("event_id", sessionEventIds) : { data: [] };
      const countMap: Record<string, number> = {};
      (reservations || []).forEach((r) => { countMap[r.event_id] = (countMap[r.event_id] || 0) + 1; });

      const totalHours = (events || []).reduce((s, e) => s + e.counted_duration_hours, 0);

      return {
        profile,
        events: (events || []).map((e) => ({ ...e, participants: countMap[e.id] || 0 })),
        totalHours,
      };
    },
  });

  // Check if session has participation rules (to show norm column)
  const { data: sessionHasRules } = useQuery({
    queryKey: ["mgr-session-has-rules", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data } = await supabase.from("class_participation_rules").select("id").eq("session_id", sessionId).limit(1);
      return !!data?.length;
    },
  });

  const handleExportSummary = () => {
    if (!filteredTeachers.length || !summary) return;
    const headers = ["Nr.", "Profesor", "Nr. evenimente", "Ore organizate"];
    if (sessionHasRules) headers.push("Norma");
    exportReportPdf({
      title: `Raport profesori — ${sessionName}`,
      headers,
      rows: filteredTeachers.map((t, i) => {
        const row = [
          String(i + 1), t`${t.last_name} ${t.first_name}`,
          String(summary[t.id]?.events || 0), String(summary[t.id]?.hours || 0) + "h",
        ];
        if (sessionHasRules) row.push(t.teaching_norm ? `${t.teaching_norm}h` : "—");
        return row;
      }),
      filename: "raport-profesori",
    });
  };

  const handleExportDetail = () => {
    if (!detail?.events.length) return;
    const name = `${detail.profile?.last_name || ""} ${detail.profile?.first_name || ""}`;
    exportReportPdf({
      title: `Raport profesor: ${name}`,
      subtitle: `Sesiune: ${sessionName} | Ore organizate: ${detail.totalHours}h`,
      headers: ["Nr.", "Data", "Eveniment", "Interval", "Ore", "Participanți", "Status"],
      rows: detail.events.map((e, i) => [
        String(i + 1), e.date, e.title, `${e.start_time?.slice(0, 5)} - ${e.end_time?.slice(0, 5)}`,
        String(e.counted_duration_hours), String(e.participants), e.status,
      ]),
      filename: `raport-profesor-${name}`,
      orientation: "landscape",
    });
  };

  if (!sessionId) return <p className="text-muted-foreground">Selectează o sesiune din meniul lateral.</p>;

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
              <TableHead>Ore organizate</TableHead>
              {sessionHasRules && <TableHead>Norma</TableHead>}
              <TableHead></TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {filteredTeachers.map((t, i) => (
              <TableRow key={t.id}>
                <TableCell>{i + 1}</TableCell>
                <TableCell>{t`${t.last_name} ${t.first_name}`}</TableCell>
                <TableCell>{summary?.[t.id]?.events || 0}</TableCell>
                <TableCell>{summary?.[t.id]?.hours || 0}h</TableCell>
                {sessionHasRules && (
                  <TableCell>
                    {t.teaching_norm ? (
                      <span className={summary?.[t.id]?.hours >= t.teaching_norm ? "text-green-600" : "text-destructive font-semibold"}>
                        {summary?.[t.id]?.hours || 0}h / {t.teaching_norm}h
                      </span>
                    ) : "—"}
                  </TableCell>
                )}
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
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Profesor</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{`${detail.profile?.last_name || ""} ${detail.profile?.first_name || ""}`}</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Nr. evenimente</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{detail.events.length}</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Ore organizate</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{detail.totalHours}h{sessionHasRules && (detail.profile as any)?.teaching_norm ? ` / ${(detail.profile as any).teaching_norm}h` : ""}</p></CardContent></Card>
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
