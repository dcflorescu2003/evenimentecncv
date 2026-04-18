import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { FileDown } from "lucide-react";
import { exportReportPdf } from "@/lib/report-pdf";
import { useNavigate } from "react-router-dom";
import { useManagerSession } from "@/components/layouts/ManagerLayout";
import { getHeldEventIds } from "@/lib/held-events";
import { formatHoursVsRequired } from "@/lib/hours-format";

export default function IncompleteNormPage() {
  const { sessionId, sessionName } = useManagerSession();
  const navigate = useNavigate();
  const [tab, setTab] = useState("teachers");

  // ── Teachers with incomplete hours (based on teaching_norm) ──
  const { data: teacherData, isLoading: teachersLoading } = useQuery({
    queryKey: ["mgr-incomplete-teachers", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      // Check if session has participation rules
      const { data: rules } = await supabase
        .from("class_participation_rules").select("id").eq("session_id", sessionId).limit(1);
      if (!rules?.length) return [];

      // Get session min_participants
      const { data: sessionData } = await supabase.from("program_sessions").select("min_participants").eq("id", sessionId).single();
      const minParticipants = (sessionData as any)?.min_participants;

      // Get all session events
      const { data: sessionEvents } = await supabase
        .from("events").select("id, counted_duration_hours, date").eq("session_id", sessionId);
      const sessionEventIds = (sessionEvents || []).map((e) => e.id);
      const eventHoursMap = Object.fromEntries((sessionEvents || []).map((e) => [e.id, e.counted_duration_hours]));

      // Get scanned ticket counts per event
      const { data: reservations } = sessionEventIds.length
        ? await supabase.from("reservations").select("id, event_id").eq("status", "reserved").in("event_id", sessionEventIds)
        : { data: [] };
      const resIds = (reservations || []).map((r) => r.id);
      const { data: tickets } = resIds.length
        ? await supabase.from("tickets").select("reservation_id, status").in("reservation_id", resIds)
        : { data: [] };
      const resEventMap = Object.fromEntries((reservations || []).map((r) => [r.id, r.event_id]));
      const ticketsByEvent: Record<string, number> = {};
      (tickets || []).forEach((t) => {
        if (t.status === "present" || t.status === "late") {
          const eid = resEventMap[t.reservation_id];
          if (eid) ticketsByEvent[eid] = (ticketsByEvent[eid] || 0) + 1;
        }
      });

      const heldIds = getHeldEventIds(sessionEvents || [], ticketsByEvent, minParticipants);

      // Get all teacher roles
      const { data: roleRows } = await supabase.from("user_roles").select("user_id").in("role", ["teacher", "homeroom_teacher", "coordinator_teacher"]);
      const teacherIds = [...new Set((roleRows || []).map((r) => r.user_id))];
      if (!teacherIds.length) return [];

      // Get profiles with teaching_norm
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, display_name, teaching_norm").in("id", teacherIds);
      const teachersWithNorm = ((profiles as any[]) || []).filter((p) => p.teaching_norm && p.teaching_norm > 0);
      if (!teachersWithNorm.length) return [];

      // Get coordinator assignments for session events
      const { data: coords } = await supabase.from("coordinator_assignments").select("teacher_id, event_id").in("teacher_id", teachersWithNorm.map((t) => t.id));
      
      const coordsByTeacher: Record<string, string[]> = {};
      (coords || []).forEach((c) => {
        if (heldIds.has(c.event_id)) {
          if (!coordsByTeacher[c.teacher_id]) coordsByTeacher[c.teacher_id] = [];
          coordsByTeacher[c.teacher_id].push(c.event_id);
        }
      });

      return teachersWithNorm
        .map((p) => {
          const evts = coordsByTeacher[p.id] || [];
          const hours = evts.reduce((s, eid) => s + (eventHoursMap[eid] || 0), 0);
          const norm = p.teaching_norm;
          if (hours >= norm) return null;
          return { id: p.id, name: `${p.last_name} ${p.first_name}`, events: evts.length, organizedHours: hours, norm, remaining: norm - hours };
        })
        .filter(Boolean)
        .sort((a, b) => a!.name.localeCompare(b!.name)) as Array<{
          id: string; name: string; events: number; organizedHours: number; norm: number; remaining: number;
        }>;
    },
  });

  // ── Students with incomplete hours ──
  const { data: studentData, isLoading: studentsLoading } = useQuery({
    queryKey: ["mgr-incomplete-students", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      // Get class rules for this session
      const { data: rules } = await supabase
        .from("class_participation_rules").select("class_id, required_value").eq("session_id", sessionId);
      if (!rules?.length) return [];

      const ruleMap = Object.fromEntries(rules.map((r) => [r.class_id, r.required_value]));
      const classIds = rules.map((r) => r.class_id);

      // Get classes
      const { data: classes } = await supabase.from("classes").select("id, display_name").in("id", classIds);
      const classNameMap = Object.fromEntries((classes || []).map((c) => [c.id, c.display_name]));

      // Get students in these classes
      const { data: assignments } = await supabase.from("student_class_assignments").select("student_id, class_id").in("class_id", classIds);
      if (!assignments?.length) return [];

      const studentClassMap = Object.fromEntries(assignments.map((a) => [a.student_id, a.class_id]));
      const studentIds = assignments.map((a) => a.student_id);

      // Get reservations for these students in this session
      const { data: reservationsData } = await supabase
        .from("reservations").select("id, student_id, event_id").eq("status", "reserved").in("student_id", studentIds);
      
      const resEventIds = [...new Set((reservationsData || []).map((r) => r.event_id))];
      const { data: events } = resEventIds.length
        ? await supabase.from("events").select("id, counted_duration_hours").eq("session_id", sessionId).in("id", resEventIds)
        : { data: [] };
      const eventHoursMap = Object.fromEntries((events || []).map((e) => [e.id, e.counted_duration_hours]));

      // Get all session events for assistant hours
      const { data: allSessionEvents } = await supabase
        .from("events").select("id, counted_duration_hours").eq("session_id", sessionId);
      const allSessionEventHoursMap = Object.fromEntries((allSessionEvents || []).map(e => [e.id, e.counted_duration_hours]));

      // Get tickets for validated hours
      const resIds = (reservationsData || []).filter((r) => eventHoursMap[r.event_id] !== undefined).map((r) => r.id);
      const { data: ticketsData } = resIds.length
        ? await supabase.from("tickets").select("reservation_id, status").in("reservation_id", resIds)
        : { data: [] };
      const ticketMap = Object.fromEntries((ticketsData || []).map((t) => [t.reservation_id, t.status]));

      // Fetch assistant assignments
      const { data: assistantAssignments } = await supabase
        .from("event_student_assistants").select("student_id, event_id").in("student_id", studentIds);
      const assistantByStudent = new Map<string, Set<string>>();
      (assistantAssignments || []).forEach(a => {
        if (allSessionEventHoursMap[a.event_id] !== undefined) {
          if (!assistantByStudent.has(a.student_id)) assistantByStudent.set(a.student_id, new Set());
          assistantByStudent.get(a.student_id)!.add(a.event_id);
        }
      });

      // Get profiles
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, display_name").in("id", studentIds);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, `${p.last_name} ${p.first_name}`]));

      // Calculate per student
      return studentIds
        .map((sid) => {
          const classId = studentClassMap[sid];
          const required = ruleMap[classId] || 0;
          if (!required) return null;

          const sRes = (reservationsData || []).filter((r) => r.student_id === sid && eventHoursMap[r.event_id] !== undefined);
          const reserved = sRes.reduce((s, r) => s + (eventHoursMap[r.event_id] || 0), 0);
          
          // Validated = ticket present/late + assistant events in session
          const validatedEventIds = new Set<string>();
          sRes.forEach(r => {
            const ts = ticketMap[r.id];
            if (ts === "present" || ts === "late") validatedEventIds.add(r.event_id);
          });
          const studentAssistantEvents = assistantByStudent.get(sid) || new Set();
          studentAssistantEvents.forEach(eid => validatedEventIds.add(eid));
          const validated = [...validatedEventIds].reduce((s, eid) => s + (allSessionEventHoursMap[eid] || eventHoursMap[eid] || 0), 0);
          const remaining = Math.max(0, required - validated);

          if (remaining <= 0) return null; // norm complete

          return {
            id: sid,
            name: profileMap[sid] || "",
            className: classNameMap[classId] || "",
            reserved,
            validated,
            required,
            remaining,
          };
        })
        .filter(Boolean)
        .sort((a, b) => a!.className.localeCompare(b!.className) || a!.name.localeCompare(b!.name)) as Array<{
          id: string; name: string; className: string; reserved: number; validated: number; required: number; remaining: number;
        }>;
    },
  });

  const handleExportTeachers = () => {
    if (!teacherData?.length) return;
    exportReportPdf({
      title: `Normă incompletă — Profesori — ${sessionName}`,
      headers: ["Nr.", "Profesor", "Nr. evenimente", "Ore organizate", "Norma", "Ore rămase"],
      rows: teacherData.map((t, i) => [
        String(i + 1), t.name, String(t.events), `${t.organizedHours}h`, `${t.norm}h`, `${t.remaining}h`,
      ]),
      filename: "norma-incompleta-profesori",
    });
  };

  const handleExportStudents = () => {
    if (!studentData?.length) return;
    exportReportPdf({
      title: `Normă incompletă — Elevi — ${sessionName}`,
      headers: ["Nr.", "Clasă", "Elev", "Ore rezervate", "Ore validate", "Ore necesare", "Ore rămase"],
      rows: studentData.map((s, i) => [
        String(i + 1), s.className, s.name,
        `${formatHoursVsRequired(s.reserved, s.required)}h`,
        `${formatHoursVsRequired(s.validated, s.required)}h`,
        `${s.required}h`, `${s.remaining}h`,
      ]),
      filename: "norma-incompleta-elevi",
      orientation: "landscape",
    });
  };

  if (!sessionId) return <p className="text-muted-foreground">Selectează o sesiune din meniul lateral.</p>;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h1 className="text-xl sm:text-2xl font-bold">Normă incompletă</h1>
        <div className="flex gap-2">
          {tab === "teachers" && teacherData?.length ? (
            <Button variant="outline" onClick={handleExportTeachers} className="w-full sm:w-auto"><FileDown className="mr-2 h-4 w-4" />Export PDF</Button>
          ) : null}
          {tab === "students" && studentData?.length ? (
            <Button variant="outline" onClick={handleExportStudents} className="w-full sm:w-auto"><FileDown className="mr-2 h-4 w-4" />Export PDF</Button>
          ) : null}
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab}>
        <TabsList>
          <TabsTrigger value="teachers">Profesori ({teacherData?.length || 0})</TabsTrigger>
          <TabsTrigger value="students">Elevi ({studentData?.length || 0})</TabsTrigger>
        </TabsList>

        <TabsContent value="teachers" className="mt-4">
          {teachersLoading && <p className="text-muted-foreground">Se încarcă...</p>}
          {!teachersLoading && !teacherData?.length && <p className="text-muted-foreground">Toți profesorii au norma completă.</p>}
          {teacherData && teacherData.length > 0 && (
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
                      <TableHead>Norma</TableHead>
                      <TableHead>Ore rămase</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {teacherData.map((t, i) => (
                      <TableRow key={t.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{t.name}</TableCell>
                        <TableCell>{t.events}</TableCell>
                        <TableCell>{t.organizedHours}h</TableCell>
                        <TableCell>{t.norm}h</TableCell>
                        <TableCell className="font-semibold text-destructive">{t.remaining}h</TableCell>
                        <TableCell><Button variant="link" size="sm" onClick={() => navigate(`/manager/teachers?id=${t.id}&from=incomplete`)}>Detalii</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile */}
              <div className="md:hidden space-y-2">
                {teacherData.map((t, i) => (
                  <div key={t.id} className="rounded-lg border bg-card p-3 space-y-1 cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/manager/teachers?id=${t.id}&from=incomplete`)}>
                    <p className="font-medium">{i + 1}. {t.name}</p>
                    <p className="text-xs text-muted-foreground">{t.events} evenimente · {t.organizedHours}h / {t.norm}h</p>
                    <p className="text-xs font-semibold text-destructive">Rămase: {t.remaining}h</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>

        <TabsContent value="students" className="mt-4">
          {studentsLoading && <p className="text-muted-foreground">Se încarcă...</p>}
          {!studentsLoading && !studentData?.length && <p className="text-muted-foreground">Toți elevii au norma completă.</p>}
          {studentData && studentData.length > 0 && (
            <>
              {/* Desktop */}
              <div className="hidden md:block overflow-x-auto rounded-lg border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead className="w-12">Nr.</TableHead>
                      <TableHead>Clasă</TableHead>
                      <TableHead>Elev</TableHead>
                      <TableHead>Ore rezervate</TableHead>
                      <TableHead>Ore validate</TableHead>
                      <TableHead>Ore necesare</TableHead>
                      <TableHead>Ore rămase</TableHead>
                      <TableHead></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {studentData.map((s, i) => (
                      <TableRow key={s.id}>
                        <TableCell>{i + 1}</TableCell>
                        <TableCell>{s.className}</TableCell>
                        <TableCell>{s.name}</TableCell>
                        <TableCell>{formatHoursVsRequired(s.reserved, s.required)}h</TableCell>
                        <TableCell>{formatHoursVsRequired(s.validated, s.required)}h</TableCell>
                        <TableCell>{s.required}h</TableCell>
                        <TableCell className="font-semibold text-destructive">{s.remaining}h</TableCell>
                        <TableCell><Button variant="link" size="sm" onClick={() => navigate(`/manager/students?id=${s.id}&from=incomplete`)}>Detalii</Button></TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
              {/* Mobile */}
              <div className="md:hidden space-y-2">
                {studentData.map((s, i) => (
                  <div key={s.id} className="rounded-lg border bg-card p-3 space-y-1 cursor-pointer hover:bg-muted/30" onClick={() => navigate(`/manager/students?id=${s.id}&from=incomplete`)}>
                    <p className="font-medium">{i + 1}. {s.name}</p>
                    <p className="text-xs text-muted-foreground">{s.className} · Validate: {formatHoursVsRequired(s.validated, s.required)}h / {s.required}h</p>
                    <p className="text-xs font-semibold text-destructive">Rămase: {s.remaining}h</p>
                  </div>
                ))}
              </div>
            </>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}
