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

export default function ClassReportPage() {
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
    queryKey: ["mgr-class-report", classId],
    enabled: !!classId,
    queryFn: async () => {
      // Get students in the class
      const { data: assignments } = await supabase.from("student_class_assignments").select("student_id").eq("class_id", classId);
      const studentIds = (assignments || []).map((a) => a.student_id);
      if (!studentIds.length) return { students: [], events: [] };

      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name, display_name").in("id", studentIds);
      const profileMap = Object.fromEntries((profiles || []).map((p) => [p.id, p.display_name || `${p.last_name} ${p.first_name}`]));

      // Get reservations for these students
      const { data: reservations } = await supabase.from("reservations").select("student_id, event_id, status").in("student_id", studentIds).eq("status", "reserved");

      const eventIds = [...new Set((reservations || []).map((r) => r.event_id))];
      const { data: events } = eventIds.length ? await supabase.from("events").select("id, title, date").in("id", eventIds).order("date") : { data: [] };

      const studentEventMap: Record<string, Set<string>> = {};
      (reservations || []).forEach((r) => {
        if (!studentEventMap[r.student_id]) studentEventMap[r.student_id] = new Set();
        studentEventMap[r.student_id].add(r.event_id);
      });

      const students = studentIds.map((id) => ({
        id,
        name: profileMap[id] || "",
        enrolledCount: studentEventMap[id]?.size || 0,
        enrolled: !!studentEventMap[id]?.size,
      })).sort((a, b) => a.name.localeCompare(b.name));

      return { students, events: events || [] };
    },
  });

  const className = classes?.find((c) => c.id === classId)?.display_name || "";

  const handleExport = () => {
    if (!report) return;
    exportReportPdf({
      title: `Raport clasă ${className}`,
      headers: ["Nr.", "Nume elev", "Inscris", "Nr. evenimente"],
      rows: report.students.map((s, i) => [String(i + 1), s.name, s.enrolled ? "Da" : "Nu", String(s.enrolledCount)]),
      filename: `raport-clasa-${className}`,
    });
  };

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
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Nr.</TableHead>
                <TableHead>Nume elev</TableHead>
                <TableHead>Înscris</TableHead>
                <TableHead>Nr. evenimente</TableHead>
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
