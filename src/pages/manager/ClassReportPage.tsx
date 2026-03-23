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
  const { sessionId } = useManagerSession();
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

  const { data: report, isLoading } = useQuery({
    queryKey: ["mgr-class-report", classId, sessionId],
    enabled: !!classId && !!sessionId,
    queryFn: async () => {
      const { data: assignments } = await supabase.from("student_class_assignments").select("student_id").eq("class_id", classId);
      const studentIds = (assignments || []).map((a) => a.student_id);
      if (!studentIds.length) return { students: [], events: [] };

      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, display_name").in("id", studentIds);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p`${p.last_name} ${p.first_name}`]));

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

      // Get class rule for required hours
      const { data: rules } = await supabase.from("class_participation_rules").select("required_value").eq("class_id", classId).eq("session_id", sessionId).limit(1);
      const requiredHours = rules?.[0]?.required_value || 0;

      const students = studentIds.map((id) => {
        const sRes = sessionReservations.filter((r) => r.student_id === id);
        const reserved = sRes.reduce((s, r) => s + (eventHoursMap[r.event_id] || 0), 0);
        const validated = sRes.filter((r) => { const ts = ticketMap[r.id]; return ts === "present" || ts === "late"; }).reduce((s, r) => s + (eventHoursMap[r.event_id] || 0), 0);
        return {
          id,
          name: profileMap[id] || "",
          enrolled: sRes.length > 0,
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

  if (!sessionId) return <p className="text-muted-foreground">Selectează o sesiune din meniul lateral.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Raport pe clase</h1>
        {report?.students.length ? <Button variant="outline" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" />Export PDF</Button> : null}
      </div>

      <div className="flex gap-4">
        <Input placeholder="Caută clasă..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Selectează clasa" /></SelectTrigger>
          <SelectContent>
            {filteredClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading && <p className="text-muted-foreground">Se încarcă...</p>}

      {report && (
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
