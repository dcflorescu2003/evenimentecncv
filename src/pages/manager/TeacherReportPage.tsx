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
import { getHeldEventIds } from "@/lib/held-events";

export default function TeacherReportPage() {
  const { sessionId, sessionName } = useManagerSession();
  const [searchParams] = useSearchParams();
  const [selectedId, setSelectedId] = useState(searchParams.get("id") || "");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();
  const fromPage = searchParams.get("from");

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
    const name = (`${t.last_name} ${t.first_name}`).toLowerCase();
    return name.includes(search.toLowerCase());
  });

  // Summary scoped to session — only held events count
  const { data: summary } = useQuery({
    queryKey: ["mgr-teacher-summary", sessionId],
    enabled: !!teachers?.length && !!sessionId,
    queryFn: async () => {
      const teacherIds = (teachers || []).map((t) => t.id);
      const { data: coords } = await supabase.from("coordinator_assignments").select("teacher_id, event_id").in("teacher_id", teacherIds);
      const allEventIds = [...new Set((coords || []).map((c) => c.event_id))];
      const { data: events } = allEventIds.length
        ? await supabase.from("events").select("id, counted_duration_hours, session_id, date").in("id", allEventIds)
        : { data: [] };
      
      const sessionEvents = (events || []).filter((e) => e.session_id === sessionId);
      const sessionEventIds = sessionEvents.map((e) => e.id);

      // Get session min_participants
      const { data: sessionData } = await supabase.from("program_sessions").select("min_participants").eq("id", sessionId).single();
      const minParticipants = (sessionData as any)?.min_participants;

      // Get scanned ticket counts per event
      const { data: reservations } = sessionEventIds.length
        ? await supabase.from("reservations").select("id, event_id").eq("status", "reserved").in("event_id", sessionEventIds)
        : { data: [] };
      const resIds = (reservations || []).map((r) => r.id);
      const { data: tickets } = resIds.length
        ? await supabase.from("tickets").select("reservation_id, status").in("reservation_id", resIds)
        : { data: [] };
      
      const ticketsByEvent: Record<string, number> = {};
      const resEventMap = Object.fromEntries((reservations || []).map((r) => [r.id, r.event_id]));
      (tickets || []).forEach((t) => {
        if (t.status === "present" || t.status === "late") {
          const eid = resEventMap[t.reservation_id];
          if (eid) ticketsByEvent[eid] = (ticketsByEvent[eid] || 0) + 1;
        }
      });

      const heldIds = getHeldEventIds(sessionEvents, ticketsByEvent, minParticipants);
      const eventHoursMap = Object.fromEntries(sessionEvents.map((e) => [e.id, e.counted_duration_hours]));

      const coordsByTeacher: Record<string, string[]> = {};
      (coords || []).forEach((c) => {
        if (heldIds.has(c.event_id)) {
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

      // Get session min_participants
      const { data: sessionData } = await supabase.from("program_sessions").select("min_participants").eq("id", sessionId).single();
      const minParticipants = (sessionData as any)?.min_participants;

      // Get scanned ticket counts
      const { data: reservations } = sessionEventIds.length ? await supabase.from("reservations").select("id, event_id").eq("status", "reserved").in("event_id", sessionEventIds) : { data: [] };
      const resIds = (reservations || []).map((r) => r.id);
      const { data: tickets } = resIds.length ? await supabase.from("tickets").select("reservation_id, status").in("reservation_id", resIds) : { data: [] };

      const resEventMap = Object.fromEntries((reservations || []).map((r) => [r.id, r.event_id]));
      const ticketsByEvent: Record<string, number> = {};
      const countMap: Record<string, number> = {};
      (reservations || []).forEach((r) => { countMap[r.event_id] = (countMap[r.event_id] || 0) + 1; });
      (tickets || []).forEach((t) => {
        if (t.status === "present" || t.status === "late") {
          const eid = resEventMap[t.reservation_id];
          if (eid) ticketsByEvent[eid] = (ticketsByEvent[eid] || 0) + 1;
        }
      });

      const heldIds = getHeldEventIds(events || [], ticketsByEvent, minParticipants);

      const totalHours = (events || []).filter(e => heldIds.has(e.id)).reduce((s, e) => s + e.counted_duration_hours, 0);

      return {
        profile,
        events: (events || []).map((e) => ({ ...e, participants: countMap[e.id] || 0, isHeld: heldIds.has(e.id) })),
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
          String(i + 1), `${t.last_name} ${t.first_name}`,
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
      headers: ["Nr.", "Data", "Eveniment", "Interval", "Ore", "Participanți", "Status", "Desfășurat"],
      rows: detail.events.map((e, i) => [
        String(i + 1), e.date, e.title, `${e.start_time?.slice(0, 5)} - ${e.end_time?.slice(0, 5)}`,
        String(e.counted_duration_hours), String(e.participants), e.status, e.isHeld ? "Da" : "Nu",
      ]),
      filename: `raport-profesor-${name}`,
      orientation: "landscape",
    });
  };

  const handleBack = () => {
    if (fromPage === "incomplete") {
      navigate("/manager/incomplete");
    } else {
      setSelectedId("");
    }
  };

  if (!sessionId) return <p className="text-muted-foreground">Selectează o sesiune din meniul lateral.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">Raport pe profesori</h1>
        <div className="flex gap-2">
          {!selectedId && filteredTeachers.length ? <Button variant="outline" onClick={handleExportSummary} className="w-full sm:w-auto"><FileDown className="mr-2 h-4 w-4" />Export PDF</Button> : null}
          {selectedId && detail?.events.length ? <Button variant="outline" onClick={handleExportDetail} className="w-full sm:w-auto"><FileDown className="mr-2 h-4 w-4" />Export PDF</Button> : null}
        </div>
      </div>

      <div className="flex flex-col gap-2 sm:flex-row sm:gap-4">
        <Input placeholder="Caută profesor..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-full sm:w-80" />
        {selectedId && <Button variant="ghost" onClick={handleBack} className="w-full sm:w-auto">← Înapoi la {fromPage === "incomplete" ? "normă incompletă" : "listă"}</Button>}
      </div>

      {!selectedId ? (
        <>
          {/* Desktop */}
          <div className="hidden md:block overflow-x-auto rounded-lg border">
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
                    <TableCell>{`${t.last_name} ${t.first_name}`}</TableCell>
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
          </div>

          {/* Mobile cards */}
          <div className="md:hidden space-y-2">
            {filteredTeachers.map((t, i) => (
              <div key={t.id} className="rounded-lg border bg-card p-3 space-y-1 cursor-pointer hover:bg-muted/30" onClick={() => setSelectedId(t.id)}>
                <p className="font-medium">{i + 1}. {`${t.last_name} ${t.first_name}`}</p>
                <p className="text-xs text-muted-foreground">
                  {summary?.[t.id]?.events || 0} evenimente · {summary?.[t.id]?.hours || 0}h organizate
                </p>
                {sessionHasRules && t.teaching_norm && (
                  <p className={`text-xs ${summary?.[t.id]?.hours >= t.teaching_norm ? "text-green-600" : "text-destructive font-semibold"}`}>
                    Normă: {summary?.[t.id]?.hours || 0}h / {t.teaching_norm}h
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      ) : (
        <>
          {detailLoading && <p className="text-muted-foreground">Se încarcă...</p>}
          {detail && (
            <>
              <div className="grid gap-4 grid-cols-1 sm:grid-cols-3">
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Profesor</CardTitle></CardHeader><CardContent><p className="text-base sm:text-lg font-bold break-words">{`${detail.profile?.last_name || ""} ${detail.profile?.first_name || ""}`}</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Nr. evenimente desfășurate</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{detail.events.filter(e => e.isHeld).length}</p></CardContent></Card>
                <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Ore organizate</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{detail.totalHours}h{sessionHasRules && (detail.profile as any)?.teaching_norm ? ` / ${(detail.profile as any).teaching_norm}h` : ""}</p></CardContent></Card>
              </div>

              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto rounded-lg border">
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
                      <TableHead>Desfășurat</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detail.events.map((e, i) => (
                      <TableRow key={e.id} className={!e.isHeld ? "opacity-50" : ""}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{e.date}</TableCell>
                        <TableCell>{e.title}</TableCell>
                        <TableCell>{e.start_time?.slice(0, 5)} - {e.end_time?.slice(0, 5)}</TableCell>
                        <TableCell>{e.counted_duration_hours}h</TableCell>
                        <TableCell>{e.participants}</TableCell>
                        <TableCell>{e.status}</TableCell>
                        <TableCell>{e.isHeld ? "✓" : "—"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Mobile */}
              <div className="md:hidden space-y-2">
                {detail.events.map((e, i) => (
                  <div key={e.id} className={`rounded-lg border bg-card p-3 space-y-1 ${!e.isHeld ? "opacity-60" : ""}`}>
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium min-w-0 flex-1 break-words">{i + 1}. {e.title}</p>
                      <Badge variant={e.isHeld ? "default" : "secondary"} className="shrink-0">{e.isHeld ? "✓ Desf." : e.status}</Badge>
                    </div>
                    <p className="text-xs text-muted-foreground">
                      {e.date} · {e.start_time?.slice(0, 5)}–{e.end_time?.slice(0, 5)} · {e.counted_duration_hours}h · {e.participants} part.
                    </p>
                  </div>
                ))}
              </div>
            </>
          )}
        </>
      )}
    </div>
  );
}
