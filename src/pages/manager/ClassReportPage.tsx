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

  // ── All-classes summary — always loaded ──
  const { data: allClassesSummary, isLoading: summaryLoading } = useQuery({
    queryKey: ["mgr-all-classes-summary", sessionId],
    enabled: !!sessionId,
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

  // Filter by selected class if any
  const displayedClasses = classId
    ? (allClassesSummary || []).filter(c => c.classId === classId)
    : (allClassesSummary || []);

  const handleExportAllClasses = () => {
    if (!displayedClasses.length) return;
    const rows: string[][] = [];
    displayedClasses.forEach(c => {
      rows.push([c.className, "", "", "", String(c.studentCount) + " elevi total"]);
      c.events.forEach(e => {
        rows.push(["", e.date, e.title, `${e.start_time?.slice(0, 5)} - ${e.end_time?.slice(0, 5)}`, String(e.studentCount) + " elevi"]);
      });
    });
    exportReportPdf({
      title: classId
        ? `Raport clasă ${displayedClasses[0]?.className} — ${sessionName}`
        : `Raport toate clasele — ${sessionName}`,
      headers: ["Clasă", "Data", "Eveniment", "Interval", "Participanți"],
      rows,
      filename: classId ? `raport-clasa-${displayedClasses[0]?.className}` : `raport-toate-clasele`,
      orientation: "landscape",
    });
  };

  if (!sessionId) return <p className="text-muted-foreground">Selectează o sesiune din meniul lateral.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Raport pe clase</h1>
        {displayedClasses.length ? <Button variant="outline" onClick={handleExportAllClasses}><FileDown className="mr-2 h-4 w-4" />Export PDF</Button> : null}
      </div>

      <div className="flex gap-4">
        <Input placeholder="Caută clasă..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-56" />
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-48"><SelectValue placeholder="Toate clasele" /></SelectTrigger>
          <SelectContent>
            {filteredClasses.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
        {classId && <Button variant="ghost" onClick={() => setClassId("")}>← Toate clasele</Button>}
      </div>

      {summaryLoading && <p className="text-muted-foreground">Se încarcă...</p>}

      {!summaryLoading && !displayedClasses.length && (
        <p className="text-muted-foreground">Nu sunt evenimente cu participanți din clase active în această sesiune.</p>
      )}

      {displayedClasses.length > 0 && (
        <div className="space-y-6">
          {displayedClasses.map(c => (
            <div key={c.classId} className="space-y-2">
              <h3 className="font-semibold text-lg flex items-center gap-2">
                {c.className}
                <Badge variant="secondary">{c.studentCount} elevi</Badge>
              </h3>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Data</TableHead>
                    <TableHead>Eveniment</TableHead>
                    <TableHead>Interval</TableHead>
                    <TableHead>Durata</TableHead>
                    <TableHead>Elevi înscriși</TableHead>
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
    </div>
  );
}
