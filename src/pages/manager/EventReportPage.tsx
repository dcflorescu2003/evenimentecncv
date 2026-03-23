import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { ChevronDown, FileDown, FileText, Upload } from "lucide-react";
import { exportReportPdf } from "@/lib/report-pdf";
import { useNavigate } from "react-router-dom";
import { useManagerSession } from "@/components/layouts/ManagerLayout";

const statusLabel = (s: string) => {
  if (s === "present" || s === "late") return "Prezent";
  if (s === "excused") return "Absent motivat";
  return "Absent";
};

const statusSubmissionLabel = (s: string) => {
  if (s === "accepted") return "Acceptat";
  if (s === "rejected") return "Respins";
  if (s === "reviewed") return "Revizuit";
  return "Încărcat";
};

function EventDocumentsSection({ eventId }: { eventId: string }) {
  const [open, setOpen] = useState(true);

  const { data: eventFiles } = useQuery({
    queryKey: ["mgr-event-files", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await supabase
        .from("event_files").select("id, title, file_category, file_name, description").eq("event_id", eventId);
      return data || [];
    },
  });

  const { data: formSubmissions } = useQuery({
    queryKey: ["mgr-form-submissions", eventId],
    enabled: !!eventId,
    queryFn: async () => {
      const { data } = await supabase
        .from("form_submissions").select("id, form_title, student_id, status, file_name, uploaded_at").eq("event_id", eventId);
      if (!data?.length) return [];
      const studentIds = [...new Set(data.map((f) => f.student_id))];
      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, display_name").in("id", studentIds);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p`${p.last_name} ${p.first_name}`]));
      return data.map((f) => ({ ...f, studentName: profileMap[f.student_id] || "" }));
    },
  });

  const dossierFiles = (eventFiles || []).filter((f) => f.file_category === "event_dossier");
  const templateFiles = (eventFiles || []).filter((f) => f.file_category === "form_template");

  if (!eventFiles?.length && !formSubmissions?.length) return null;

  return (
    <Collapsible open={open} onOpenChange={setOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="flex items-center gap-2 text-base font-semibold p-0 h-auto hover:bg-transparent">
          <ChevronDown className={`h-4 w-4 transition-transform ${open ? "" : "-rotate-90"}`} />
          Documente eveniment
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent className="mt-3 space-y-4">
        {dossierFiles.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" /> Dosar eveniment ({dossierFiles.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {dossierFiles.map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <span className="font-medium">{f.title}</span>
                    <span className="text-muted-foreground">— {f.file_name}</span>
                    {f.description && <span className="text-muted-foreground text-xs">({f.description})</span>}
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {templateFiles.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <FileText className="h-4 w-4" /> Șabloane formulare ({templateFiles.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <ul className="space-y-1 text-sm">
                {templateFiles.map((f) => (
                  <li key={f.id} className="flex items-center gap-2">
                    <span className="font-medium">{f.title}</span>
                    <span className="text-muted-foreground">— {f.file_name}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}

        {formSubmissions && formSubmissions.length > 0 && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Upload className="h-4 w-4" /> Acorduri încărcate de elevi ({formSubmissions.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Elev</TableHead>
                    <TableHead>Formular</TableHead>
                    <TableHead>Fișier</TableHead>
                    <TableHead>Status</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {formSubmissions.map((f) => (
                    <TableRow key={f.id}>
                      <TableCell>{f.studentName}</TableCell>
                      <TableCell>{f.form_title}</TableCell>
                      <TableCell className="text-muted-foreground text-xs">{f.file_name}</TableCell>
                      <TableCell>
                        <Badge variant={f.status === "accepted" ? "default" : f.status === "rejected" ? "destructive" : "secondary"}>
                          {statusSubmissionLabel(f.status)}
                        </Badge>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        )}
      </CollapsibleContent>
    </Collapsible>
  );
}


export default function EventReportPage() {
  const { sessionId } = useManagerSession();
  const [eventId, setEventId] = useState("");
  const navigate = useNavigate();

  const { data: events } = useQuery({
    queryKey: ["mgr-events", sessionId],
    enabled: !!sessionId,
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, title, date").eq("session_id", sessionId).order("date");
      return data || [];
    },
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ["mgr-event-report", eventId, sessionId],
    enabled: !!eventId && !!sessionId,
    queryFn: async () => {
      const { data: reservations } = await supabase
        .from("reservations").select("id, student_id, status").eq("event_id", eventId).eq("status", "reserved");

      const resIds = (reservations || []).map((r) => r.id);
      const studentIds = (reservations || []).map((r) => r.student_id);

      const [ticketsRes, profilesRes, classAssignRes, assistantsRes, coordsRes] = await Promise.all([
        resIds.length ? supabase.from("tickets").select("reservation_id, status").in("reservation_id", resIds) : { data: [] },
        studentIds.length ? supabase.from("profiles").select("id, first_name, last_name, display_name").in("id", studentIds) : { data: [] },
        studentIds.length ? supabase.from("student_class_assignments").select("student_id, class_id").in("student_id", studentIds) : { data: [] },
        supabase.from("event_student_assistants").select("student_id").eq("event_id", eventId),
        supabase.from("coordinator_assignments").select("teacher_id").eq("event_id", eventId),
      ]);

      const tickets = ticketsRes.data || [];
      const profiles = profilesRes.data || [];
      const classAssign = classAssignRes.data || [];
      const assistantIds = (assistantsRes.data || []).map((a) => a.student_id);
      const coordIds = (coordsRes.data || []).map((c) => c.teacher_id);

      const classIds = [...new Set(classAssign.map((ca) => ca.class_id))];
      const allExtraIds = [...new Set([...assistantIds, ...coordIds])];

      const [classesRes, extraProfilesRes] = await Promise.all([
        classIds.length ? supabase.from("classes").select("id, display_name").in("id", classIds) : { data: [] },
        allExtraIds.length ? supabase.from("profiles").select("id, first_name, last_name, display_name").in("id", allExtraIds) : { data: [] },
      ]);

      const classMap = Object.fromEntries((classesRes.data || []).map((c) => [c.id, c.display_name]));
      const allProfiles = [...profiles, ...(extraProfilesRes.data || [])];
      const profileMap = Object.fromEntries(allProfiles.map((p) => [p.id, p`${p.last_name} ${p.first_name}`]));
      const studentClassMap = Object.fromEntries(classAssign.map((ca) => [ca.student_id, classMap[ca.class_id] || ""]));
      const ticketMap = Object.fromEntries(tickets.map((t) => [t.reservation_id, t.status]));

      // Get student hours for this session
      const allStudentIds = [...new Set([...studentIds, ...assistantIds])];
      let studentHoursMap: Record<string, { reserved: number; validated: number; required: number }> = {};
      if (allStudentIds.length) {
        const { data: allRes } = await supabase.from("reservations").select("student_id, event_id, id").eq("status", "reserved").in("student_id", allStudentIds);
        const allResEventIds = [...new Set((allRes || []).map((r) => r.event_id))];
        const { data: allEvents } = allResEventIds.length ? await supabase.from("events").select("id, counted_duration_hours, session_id").in("id", allResEventIds).eq("session_id", sessionId) : { data: [] };
        const eventHoursMap = Object.fromEntries((allEvents || []).map((e) => [e.id, e.counted_duration_hours]));
        const sessionResIds = (allRes || []).filter((r) => eventHoursMap[r.event_id] !== undefined).map((r) => r.id);
        const { data: allTickets } = sessionResIds.length ? await supabase.from("tickets").select("reservation_id, status").in("reservation_id", sessionResIds) : { data: [] };
        const allTicketMap = Object.fromEntries((allTickets || []).map((t) => [t.reservation_id, t.status]));

        // Get class rules for required hours
        const { data: classRules } = await supabase.from("class_participation_rules").select("class_id, required_value").eq("session_id", sessionId);
        const ruleMap = Object.fromEntries((classRules || []).map((r) => [r.class_id, r.required_value]));
        const studentClassIdMap = Object.fromEntries(classAssign.map((ca) => [ca.student_id, ca.class_id]));

        allStudentIds.forEach((sid) => {
          const sRes = (allRes || []).filter((r) => r.student_id === sid && eventHoursMap[r.event_id] !== undefined);
          const reserved = sRes.reduce((s, r) => s + (eventHoursMap[r.event_id] || 0), 0);
          const validated = sRes.filter((r) => { const ts = allTicketMap[r.id]; return ts === "present" || ts === "late"; }).reduce((s, r) => s + (eventHoursMap[r.event_id] || 0), 0);
          const classId = studentClassIdMap[sid];
          const required = classId ? (ruleMap[classId] || 0) : 0;
          studentHoursMap[sid] = { reserved, validated, required };
        });
      }

      const students = (reservations || []).map((r) => ({
        id: r.student_id,
        name: profileMap[r.student_id] || "",
        className: studentClassMap[r.student_id] || "",
        status: ticketMap[r.id] || "reserved",
        ...(studentHoursMap[r.student_id] || { reserved: 0, validated: 0, required: 0 }),
      }));

      return {
        students: students.sort((a, b) => a.className.localeCompare(b.className) || a.name.localeCompare(b.name)),
        assistants: assistantIds.map((id) => ({ id, name: profileMap[id] || "", ...(studentHoursMap[id] || { reserved: 0, validated: 0, required: 0 }) })),
        coordinators: coordIds.map((id) => ({ id, name: profileMap[id] || "" })),
      };
    },
  });

  const eventTitle = events?.find((e) => e.id === eventId)?.title || "";

  const handleExport = () => {
    if (!report) return;
    const rows = report.students.map((s, i) => [String(i + 1), s.className, s.name, statusLabel(s.status), String(s.reserved) + "h", String(s.validated) + "h", String(Math.max(0, s.required - s.validated)) + "h"]);
    rows.push([], ["", "", "ASISTENȚI:", report.assistants.map((a) => a.name).join(", "), "", "", ""]);
    rows.push(["", "", "COORDONATORI:", report.coordinators.map((c) => c.name).join(", "), "", "", ""]);
    exportReportPdf({ title: "Lista de prezență", subtitle: eventTitle, headers: ["Nr.", "Clasă", "Nume", "Status", "Ore rez.", "Ore val.", "Ore răm."], rows, filename: `prezenta-${eventTitle}`, orientation: "landscape" });
  };

  if (!sessionId) return <p className="text-muted-foreground">Selectează o sesiune din meniul lateral.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Raport pe eveniment</h1>
        {report?.students.length ? <Button variant="outline" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" />Export PDF</Button> : null}
      </div>

      <Select value={eventId} onValueChange={setEventId}>
        <SelectTrigger className="w-80"><SelectValue placeholder="Selectează evenimentul" /></SelectTrigger>
        <SelectContent>{events?.map((e) => <SelectItem key={e.id} value={e.id}>{e.date} — {e.title}</SelectItem>)}</SelectContent>
      </Select>

      {isLoading && <p className="text-muted-foreground">Se încarcă...</p>}

      {eventId && <EventDocumentsSection eventId={eventId} />}

      {report && (
        <>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Nr.</TableHead>
                <TableHead>Clasă</TableHead>
                <TableHead>Nume elev</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Ore rezervate</TableHead>
                <TableHead>Ore validate</TableHead>
                <TableHead>Ore rămase</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.students.map((s, i) => (
                <TableRow key={s.id}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{s.className}</TableCell>
                  <TableCell>
                    <button className="text-primary underline hover:no-underline" onClick={() => navigate(`/manager/students?id=${s.id}`)}>{s.name}</button>
                  </TableCell>
                  <TableCell><Badge variant={s.status === "present" || s.status === "late" ? "default" : "secondary"}>{statusLabel(s.status)}</Badge></TableCell>
                  <TableCell>{s.reserved}h</TableCell>
                  <TableCell>{s.validated}h</TableCell>
                  <TableCell>{Math.max(0, s.required - s.validated)}h</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>

          {report.assistants.length > 0 && (
            <div>
              <h3 className="font-semibold mb-1">Asistenți elevi</h3>
              <p className="text-sm text-muted-foreground">
                {report.assistants.map((a, i) => (
                  <span key={a.id}>
                    <button className="text-primary underline hover:no-underline" onClick={() => navigate(`/manager/students?id=${a.id}`)}>{a.name}</button>
                    {i < report.assistants.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            </div>
          )}

          {report.coordinators.length > 0 && (
            <div>
              <h3 className="font-semibold mb-1">Profesori coordonatori</h3>
              <p className="text-sm text-muted-foreground">
                {report.coordinators.map((c, i) => (
                  <span key={c.id}>
                    <button className="text-primary underline hover:no-underline" onClick={() => navigate(`/manager/teachers?id=${c.id}`)}>{c.name}</button>
                    {i < report.coordinators.length - 1 ? ", " : ""}
                  </span>
                ))}
              </p>
            </div>
          )}
        </>
      )}
    </div>
  );
}
