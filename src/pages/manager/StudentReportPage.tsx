import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { FileDown } from "lucide-react";
import { exportReportPdf } from "@/lib/report-pdf";
import { useSearchParams, useNavigate } from "react-router-dom";
import { useManagerSession } from "@/components/layouts/ManagerLayout";
import { formatHoursVsRequired } from "@/lib/hours-format";

const statusLabel = (s: string) => {
  if (s === "present" || s === "late") return "Prezent";
  if (s === "excused") return "Absent motivat";
  if (s === "reserved") return "Rezervat";
  return "Absent";
};

export default function StudentReportPage() {
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

  const { data: students } = useQuery({
    queryKey: ["mgr-students-search", search],
    enabled: search.length >= 2,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name")
        .or(`first_name.ilike.%${search}%,last_name.ilike.%${search}%,display_name.ilike.%${search}%`)
        .limit(20);
      if (!data?.length) return [];
      const ids = data.map((p) => p.id);
      const { data: roles } = await supabase.from("user_roles").select("user_id").eq("role", "student").in("user_id", ids);
      const studentIds = new Set((roles || []).map((r) => r.user_id));
      return data.filter((p) => studentIds.has(p.id));
    },
  });

  const { data: report, isLoading } = useQuery({
    queryKey: ["mgr-student-detail", selectedId, sessionId],
    enabled: !!selectedId && !!sessionId,
    queryFn: async () => {
      const [profileRes, classRes] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name, display_name").eq("id", selectedId).single(),
        supabase.from("student_class_assignments").select("class_id, classes(display_name)").eq("student_id", selectedId).limit(1).single(),
      ]);

      // Get reservations for this session only
      const { data: reservations } = await supabase
        .from("reservations")
        .select("id, event_id, status, events(id, title, date, start_time, end_time, counted_duration_hours, session_id)")
        .eq("student_id", selectedId)
        .eq("status", "reserved");

      const sessionReservations = (reservations || []).filter((r) => (r.events as any)?.session_id === sessionId);

      const resIds = sessionReservations.map((r) => r.id);
      const { data: tickets } = resIds.length
        ? await supabase.from("tickets").select("reservation_id, status").in("reservation_id", resIds)
        : { data: [] };
      const ticketMap = Object.fromEntries((tickets || []).map((t) => [t.reservation_id, t.status]));

      // Fetch assistant assignments for this student
      const { data: assistantData } = await supabase
        .from("event_student_assistants").select("event_id").eq("student_id", selectedId);
      const assistantEventIds = new Set((assistantData || []).map(a => a.event_id));

      // Get assistant-only events not in reservations, for this session
      const existingEventIds = new Set(sessionReservations.map(r => r.event_id));
      const newAssistantEventIds = [...assistantEventIds].filter(eid => !existingEventIds.has(eid));
      let assistantOnlyEvents: any[] = [];
      if (newAssistantEventIds.length) {
        const { data: aEvents } = await supabase
          .from("events").select("id, title, date, start_time, end_time, counted_duration_hours, session_id")
          .in("id", newAssistantEventIds).eq("session_id", sessionId);
        assistantOnlyEvents = aEvents || [];
      }

      // Get required hours
      const classId = classRes.data?.class_id;
      let requiredHours = 0;
      if (classId) {
        const { data: rules } = await supabase.from("class_participation_rules").select("required_value").eq("class_id", classId).eq("session_id", sessionId).limit(1);
        requiredHours = rules?.[0]?.required_value || 0;
      }

      const eventList = [
        ...sessionReservations.map((r) => {
          const e = r.events as any;
          const tStatus = assistantEventIds.has(r.event_id) ? "present" : (ticketMap[r.id] || "reserved");
          return {
            eventId: r.event_id, title: e?.title || "", date: e?.date || "",
            startTime: e?.start_time || "", endTime: e?.end_time || "",
            hours: e?.counted_duration_hours || 0, status: tStatus,
          };
        }),
        ...assistantOnlyEvents.map((e) => ({
          eventId: e.id, title: e.title || "", date: e.date || "",
          startTime: e.start_time || "", endTime: e.end_time || "",
          hours: e.counted_duration_hours || 0, status: "present" as string,
        })),
      ].sort((a, b) => a.date.localeCompare(b.date));

      const validatedHours = eventList.filter((e) => e.status === "present" || e.status === "late").reduce((s, e) => s + e.hours, 0);
      const totalReservedHours = eventList.reduce((s, e) => s + e.hours, 0);

      return {
        profile: profileRes.data,
        className: (classRes.data?.classes as any)?.display_name || "",
        events: eventList,
        validatedHours,
        totalReservedHours,
        requiredHours,
        remainingHours: Math.max(0, requiredHours - validatedHours),
      };
    },
  });

  const handleExport = () => {
    if (!report) return;
    const name = `${report.profile?.last_name || ""} ${report.profile?.first_name || ""}`;
    exportReportPdf({
      title: `Fișa elevului: ${name}`,
      subtitle: `Clasă: ${report.className} | Sesiune: ${sessionName} | Ore validate: ${formatHoursVsRequired(report.validatedHours, report.requiredHours)} | Ore rezervate: ${formatHoursVsRequired(report.totalReservedHours, report.requiredHours)} | Ore rămase: ${report.remainingHours}`,
      headers: ["Nr.", "Data", "Eveniment", "Interval", "Ore", "Status"],
      rows: report.events.map((e, i) => [
        String(i + 1), e.date, e.title, `${e.startTime?.slice(0, 5)} - ${e.endTime?.slice(0, 5)}`,
        String(e.hours), statusLabel(e.status),
      ]),
      filename: `fisa-elev-${name}`,
    });
  };

  if (!sessionId) return <p className="text-muted-foreground">Selectează o sesiune din meniul lateral.</p>;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold">Raport per elev</h1>
        {report?.events.length ? <Button variant="outline" onClick={handleExport}><FileDown className="mr-2 h-4 w-4" />Export PDF</Button> : null}
      </div>

      <div className="space-y-2">
        {fromPage === "incomplete" && (
          <Button variant="ghost" onClick={() => navigate("/manager/incomplete")} className="mb-2">← Înapoi la normă incompletă</Button>
        )}
        <Input placeholder="Caută elev (min 2 caractere)..." value={search} onChange={(e) => setSearch(e.target.value)} className="w-80" />
        {students?.length ? (
          <div className="flex flex-wrap gap-2">
            {students.map((s) => (
              <Button key={s.id} variant={selectedId === s.id ? "default" : "outline"} size="sm" onClick={() => setSelectedId(s.id)}>
                {`${s.last_name} ${s.first_name}`}
              </Button>
            ))}
          </div>
        ) : null}
      </div>

      {isLoading && <p className="text-muted-foreground">Se încarcă...</p>}

      {report && (
        <>
          <div className="grid gap-4 md:grid-cols-5">
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Elev</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{`${report.profile?.last_name || ""} ${report.profile?.first_name || ""}`}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Clasă</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{report.className}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Ore rezervate</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{formatHoursVsRequired(report.totalReservedHours, report.requiredHours)}{report.requiredHours > 0 ? "h" : "h"}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Ore validate</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{formatHoursVsRequired(report.validatedHours, report.requiredHours)}{report.requiredHours > 0 ? "h" : "h"}</p></CardContent></Card>
            <Card><CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-muted-foreground">Ore rămase</CardTitle></CardHeader><CardContent><p className="text-lg font-bold">{report.remainingHours}h</p></CardContent></Card>
          </div>

          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">Nr.</TableHead>
                <TableHead>Data</TableHead>
                <TableHead>Eveniment</TableHead>
                <TableHead>Interval</TableHead>
                <TableHead>Ore</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {report.events.map((e, i) => (
                <TableRow key={e.eventId}>
                  <TableCell>{i + 1}</TableCell>
                  <TableCell>{e.date}</TableCell>
                  <TableCell>{e.title}</TableCell>
                  <TableCell>{e.startTime?.slice(0, 5)} - {e.endTime?.slice(0, 5)}</TableCell>
                  <TableCell>{e.hours}h</TableCell>
                  <TableCell><Badge variant={e.status === "present" || e.status === "late" ? "default" : "secondary"}>{statusLabel(e.status)}</Badge></TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </>
      )}
    </div>
  );
}
