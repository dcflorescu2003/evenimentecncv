import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileDown } from "lucide-react";
import { exportReportPdf } from "@/lib/report-pdf";
import { useNavigate } from "react-router-dom";
import { useManagerSession } from "@/components/layouts/ManagerLayout";

export default function ClassReportPage() {
  const { sessionId, sessionName } = useManagerSession();
  const [classId, setClassId] = useState("");
  const [search, setSearch] = useState("");
  const navigate = useNavigate();

  const { data: classes } = useQuery({
    queryKey: ["mgr-classes"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id, display_name").eq("is_active", true).order("display_name");
      return data || [];
    },
  });

  const filteredClasses = (classes || []).filter((c) => c.display_name.toLowerCase().includes(search.toLowerCase()));

  // ── All-classes summary (when no class selected) ──
  const { data: allClassesSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ["mgr-all-classes-summary", sessionId],
    enabled: !classId && !!sessionId,
    queryFn: async () => {
      const { data: allClasses } = await supabase.from("classes").select("id, display_name").eq("is_active", true).order("display_name");
      if (!allClasses?.length) return [];

      const classIds = allClasses.map(c => c.id);
      
      // Get all student assignments
      const { data: assignments } = await supabase.from("student_class_assignments").select("student_id, class_id").in("class_id", classIds);
      const studentsByClass = new Map<string, Set<string>>();
      (assignments || []).forEach(a => {
        if (!studentsByClass.has(a.class_id)) studentsByClass.set(a.class_id, new Set());
        studentsByClass.get(a.class_id)!.add(a.student_id);
      });

      const allStudentIds = [...new Set((assignments || []).map(a => a.student_id))];
      if (!allStudentIds.length) return allClasses.map(c => ({ classId: c.id, className: c.display_name, studentCount: 0, events: [] }));

      // Get all reservations for these students
      const { data: reservations } = await supabase.from("reservations").select("student_id, event_id").eq("status", "reserved").in("student_id", allStudentIds);
      
      const eventIds = [...new Set((reservations || []).map(r => r.event_id))];
      const { data: events } = eventIds.length
        ? await supabase.from("events").select("id, title, date, start_time, end_time, counted_duration_hours").eq("session_id", sessionId).in("id", eventIds).order("date").order("start_time")
        : { data: [] };
      const sessionEventIds = new Set((events || []).map(e => e.id));

      // Build: for each class, which events have students from that class, and how many
      const classStudentMap = new Map<string, string>(); // student_id -> class_id
      (assignments || []).forEach(a => { classStudentMap.set(a.student_id, a.class_id); });

      // event -> class -> count of students
      const eventClassStudents = new Map<string, Map<string, number>>();
      (reservations || []).forEach(r => {
        if (!sessionEventIds.has(r.event_id)) return;
        const cid = classStudentMap.get(r.student_id);
        if (!cid) return;
        if (!eventClassStudents.has(r.event_id)) eventClassStudents.set(r.event_id, new Map());
        const m = eventClassStudents.get(r.event_id)!;
        m.set(cid, (m.get(cid) || 0) + 1);
      });

      return allClasses.map(c => {
        const studentCount = studentsByClass.get(c.id)?.size || 0;
        const classEvents = (events || [])
          .filter(e => eventClassStudents.get(e.id)?.has(c.id))
          .map(e => ({
            ...e,
            studentCount: eventClassStudents.get(e.id)?.get(c.id) || 0,
          }));
        return { classId: c.id, className: c.display_name, studentCount, events: classEvents };
      }).filter(c => c.events.length > 0);
    },
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ["mgr-class-report", classId, sessionId],
    enabled: !!classId && !!sessionId,
    queryFn: async () => {
      const { data: assignments } = await supabase.from("student_class_assignments").select("student_id").eq("class_id", classId);
      const studentIds = (assignments || []).map((a) => a.student_id);
      if (!studentIds.length) return { students: [], events: [] };

      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, display_name").in("id", studentIds);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, `${p.last_name} ${p.first_name}`]));

      // Get reservations for session
      const { data: reservations } = await supabase.from("reservations").select("id, student_id, event_id, status").in("student_id", studentIds).eq("status", "reserved");
      
      // Filter to events in selected session
      const eventIds = [...new Set((reservations || []).map((r) => r.event_id))];
      const { data: events } = eventIds.length ? await supabase.from("events").select("id, title, date, counted_duration_hours, session_id").in("id", eventIds) : { data: [] };
      const sessionEvents = (events || []).filter((e) => e.session_id === sessionId);
      const sessionEventIds = new Set(sessionEvents.map((e) => e.id));
      const eventHoursMap = Object.fromEntries(sessionEvents.map((e) => [e.id, e.counted_duration_hours]));

      const sessionReservations = (reservations || []).filter((r) => sessionEventIds.has(r.event_id));
      const resIds = sessionReservations.map((r) => r.id);
      const { data: tickets } = resIds.length ? await supabase.from("tickets").select("reservation_id, status").in("reservation_id", resIds) : { data: [] };
      const ticketMap = Object.fromEntries((tickets || []).map((t) => [t.reservation_id, t.status]));

      // Fetch assistant assignments and all session events for assistant hours
      const { data: assistantAssignments } = await supabase
        .from("event_student_assistants").select("student_id, event_id").in("student_id", studentIds);
      const { data: allSessionEventsData } = await supabase
        .from("events").select("id, counted_duration_hours").eq("session_id", sessionId);
      const allSessionEventHoursMap = Object.fromEntries((allSessionEventsData || []).map(e => [e.id, e.counted_duration_hours]));
      const assistantByStudent = new Map<string, Set<string>>();
      (assistantAssignments || []).forEach(a => {
        if (allSessionEventHoursMap[a.event_id] !== undefined) {
          if (!assistantByStudent.has(a.student_id)) assistantByStudent.set(a.student_id, new Set());
          assistantByStudent.get(a.student_id)!.add(a.event_id);
        }
      });

      // Get class rule for required hours
      const { data: rules } = await supabase.from("class_participation_rules").select("required_value").eq("class_id", classId).eq("session_id", sessionId).limit(1);
      const requiredHours = rules?.[0]?.required_value || 0;

      const students = studentIds.map((id) => {
        const sRes = sessionReservations.filter((r) => r.student_id === id);
        const reserved = sRes.reduce((s, r) => s + (eventHoursMap[r.event_id] || 0), 0);
        const validatedEventIds = new Set<string>();
        sRes.forEach(r => {
          const ts = ticketMap[r.id];
          if (ts === "present" || ts === "late") validatedEventIds.add(r.event_id);
        });
        const studentAssistantEvents = assistantByStudent.get(id) || new Set();
        studentAssistantEvents.forEach(eid => validatedEventIds.add(eid));
        const validated = [...validatedEventIds].reduce((s, eid) => s + (allSessionEventHoursMap[eid] || eventHoursMap[eid] || 0), 0);
        const enrolled = sRes.length > 0 || studentAssistantEvents.size > 0;
        return {
          id,
          name: profileMap[id] || "",
          enrolled,
          enrolledCount: sRes.length,
          reserved,
          validated,
          remaining: Math.max(0, requiredHours - validated),
        };
      }).sort((a, b) => a.name.localeCompare(b.name));

      return { students, events: sessionEvents.sort((a, b) => a.date.localeCompare(b.date)), requiredHours };
    },
  });

  const className = classes?.find((c) => c.id === classId)?.display_name || "";

  const handleExport = () => {
    if (!report) return;
    exportReportPdf({
      title: `Raport clasă ${className}`,
      headers: ["Nr.", "Nume elev", "Înscris", "Nr. ev.", "Ore rez.", "Ore val.", "Ore răm."],
      rows: report.students.map((s, i) => [String(i + 1), s.name, s.enrolled ? "Da" : "Nu", String(s.enrolledCount), String(s.reserved) + "h", String(s.validated) + "h", String(s.remaining) + "h"]),
      filename: `raport-clasa-${className}`,
    });
  };

  const handleExportAllClasses = () => {
    if (!allClassesSummary?.length) return;
    const rows: string[][] = [];
    allClassesSummary.forEach(c => {
      rows.push([c.className, "", "", "", String(c.studentCount) + " elevi"]);
      c.events.forEach(e => {
        rows.push(["", e.date, e.title, `${e.start_time?.slice(0, 5)} - ${e.end_time?.slice(0, 5)}`, String(e.studentCount) + " elevi"]);
      });
    });
    exportReportPdf({
      title: `Raport toate clasele — ${sessionName}`,
      headers: ["Clasă", "Data", "Eveniment", "Interval", "Participanți"],
      rows,
      filename: `raport-toate-clasele`,
      orientation: "landscape",
    });
  };

  if (!sessionId) return <p className="text-muted-foreground">Selectează o sesiune din meniul lateral.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Raport pe clase</h1>
        <div className="flex gap-2">
          {classId && report?.students.length ? <Button variant="outline" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" />Export PDF</Button> : null}
          {!classId && allClassesSummary?.length ? <Button variant="outline" onClick={handleExportAllClasses}><FileDown className="mr-2 h-4 w-4" />Export PDF</Button> : null}
        </div>
      </div>

      <div className="flex gap-4">
        <Input placeholder="Caută clasă..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Selectează clasa" /></SelectTrigger>
          <SelectContent>
            {filteredClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
        {classId && <Button variant="ghost" onClick={() => setClassId("")}>← Toate clasele</Button>}
      </div>

      {/* All classes summary when no class selected */}
      {!classId && (
        <>
          {summaryLoading && <p className="text-muted-foreground">Se încarcă...</p>}
          {allClassesSummary && !allClassesSummary.length && !summaryLoading && (
            <p className="text-muted-foreground">Nu sunt evenimente cu participanți din clase active în această sesiune.</p>
          )}
          {allClassesSummary && allClassesSummary.length > 0 && (
            <div className="space-y-6">
              {allClassesSummary.map(c => (
                <div key={c.classId} className="space-y-2">
                  <h3 className="font-semibold text-lg flex items-center gap-2">
                    <button className="text-primary underline hover:no-underline" onClick={() => setClassId(c.classId)}>{c.className}</button>
                    <Badge variant="secondary">{c.studentCount} elevi</Badge>
                  </h3>
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Data</TableHead>
                        <TableHead>Eveniment</TableHead>
                        <TableHead>Interval</TableHead>
                        <TableHead>Durata</TableHead>
                        <TableHead>Elevi participanți</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {c.events.map(e => (
                        <TableRow key={e.id}>
                          <TableCell>{e.date}</TableCell>
                          <TableCell>{e.title}</TableCell>
                          <TableCell>{e.start_time?.slice(0, 5)} - {e.end_time?.slice(0, 5)}</TableCell>
                          <TableCell>{e.counted_duration_hours}h</TableCell>
                          <TableCell>{e.studentCount}</TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {classId && isLoading && <p className="text-muted-foreground">Se încarcă...</p>}

      {classId && report && (
        <>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <span>Total elevi: {report.students.length}</span>
            <span>Înscriși: {report.students.filter((s) => s.enrolled).length}</span>
            <span>Neînscriși: {report.students.filter((s) => !s.enrolled).length}</span>
            {report.requiredHours > 0 && <span>Ore necesare: {report.requiredHours}h</span>}
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Nr.</TableHead>
                <TableHead>Nume elev</TableHead>
                <TableHead>Înscris</TableHead>
                <TableHead>Nr. evenimente</TableHead>
                <TableHead>Ore rezervate</TableHead>
                <TableHead>Ore validate</TableHead>
                <TableHead>Ore rămase</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.students.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>
                    <button className="text-primary underline hover:no-underline" onClick={() => navigate(`/manager/students?id=${s.id}`)}>{s.name}</button>
                  </TableCell>
                  <TableCell><Badge variant={s.enrolled ? "default" : "secondary"}>{s.enrolled ? "Da" : "Nu"}</Badge></TableCell>
                  <TableCell>{s.enrolledCount}</TableCell>
                  <TableCell>{s.reserved}h</TableCell>
                  <TableCell>{s.validated}h</TableCell>
                  <TableCell>{s.remaining}h</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {report.events.length > 0 && (
            <div>
              <h3 className="font-semibold mb-2">Evenimente la care participă clasa</h3>
              <div className="flex flex-wrap gap-2">
                {report.events.map((e) => (
                  <Badge key={e.id} variant="outline">{e.date} — {e.title}</Badge>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
