import { useState, useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { formatDate } from "@/lib/time";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Badge } from "@/components/ui/badge";
import { Download, Printer } from "lucide-react";
import { exportReportPdf } from "@/lib/report-pdf";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis } from "recharts";

export default function TeacherReportsPage() {
  const { user } = useAuth();
  const [sessionId, setSessionId] = useState<string>("");

  const { data: myClasses } = useQuery({
    queryKey: ["teacher-classes", user?.id],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id, display_name, grade_number")
        .eq("homeroom_teacher_id", user!.id).eq("is_active", true).order("grade_number");
      return data ?? [];
    },
    enabled: !!user,
  });

  const { data: sessions } = useQuery({
    queryKey: ["sessions-list"],
    queryFn: async () => {
      const { data } = await supabase.from("program_sessions").select("*").order("start_date", { ascending: false });
      return data ?? [];
    },
  });

  // Auto-select active or most recent session
  useEffect(() => {
    if (sessions && sessions.length > 0 && !sessionId) {
      const active = sessions.find(s => s.status === "active");
      setSessionId((active || sessions[0]).id);
    }
  }, [sessions, sessionId]);

  const classIds = myClasses?.map(c => c.id) ?? [];

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="font-display text-2xl font-bold">Rapoarte clasă</h1>
        <div className="flex items-center gap-2">
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selectează sesiunea" />
            </SelectTrigger>
            <SelectContent>
              {sessions?.map(s => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="outline" size="icon" onClick={() => window.print()}>
            <Printer className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {!sessionId ? (
        <p className="text-muted-foreground">Selectează o sesiune pentru a vedea raportul.</p>
      ) : (
        <Tabs defaultValue="sumar">
          <TabsList className="print:hidden">
            <TabsTrigger value="sumar">Sumar</TabsTrigger>
            <TabsTrigger value="situatie">Situație elevi</TabsTrigger>
            <TabsTrigger value="prezenta">Verificare prezență</TabsTrigger>
          </TabsList>
          <TabsContent value="sumar">
            <SumarTab sessionId={sessionId} classIds={classIds} myClasses={myClasses ?? []} />
          </TabsContent>
          <TabsContent value="situatie">
            <SituatieEleviTab sessionId={sessionId} classIds={classIds} myClasses={myClasses ?? []} />
          </TabsContent>
          <TabsContent value="prezenta">
            <VerificarePrezentaTab sessionId={sessionId} classIds={classIds} myClasses={myClasses ?? []} />
          </TabsContent>
        </Tabs>
      )}
    </div>
  );
}

/* ─── Tab 1: Sumar (existing report) ─── */
function SumarTab({ sessionId, classIds, myClasses }: { sessionId: string; classIds: string[]; myClasses: any[] }) {
  const { data: reportData, isLoading } = useQuery({
    queryKey: ["teacher-report-sumar", sessionId, classIds],
    queryFn: async () => {
      if (!sessionId || classIds.length === 0) return [];
      const { data: assignments } = await supabase.from("student_class_assignments").select("student_id, class_id").in("class_id", classIds);
      const studentIds = [...new Set((assignments ?? []).map(a => a.student_id))];
      if (studentIds.length === 0) return [];

      const { data: profiles } = await supabase.from("profiles").select("id, display_name, first_name, last_name").in("id", studentIds);
      const { data: events } = await supabase.from("events").select("id, counted_duration_hours").eq("session_id", sessionId);
      const eventIds = (events ?? []).map(e => e.id);
      const eventMap = Object.fromEntries((events ?? []).map(e => [e.id, e]));
      const { data: reservations } = await supabase.from("reservations").select("id, student_id, event_id, status").in("student_id", studentIds);
      const { data: tickets } = await supabase.from("tickets").select("id, reservation_id, status");
      const ticketByRes = Object.fromEntries((tickets ?? []).map(t => [t.reservation_id, t]));
      const classMap = Object.fromEntries((assignments ?? []).map(a => [a.student_id, a.class_id]));
      const classNameMap = Object.fromEntries((myClasses ?? []).map(c => [c.id, c.display_name]));

      return (profiles ?? []).map(p => {
        const sRes = (reservations ?? []).filter(r => r.student_id === p.id && r.status === "reserved" && eventIds.includes(r.event_id));
        const reservedHours = sRes.reduce((s, r) => s + (eventMap[r.event_id]?.counted_duration_hours ?? 0), 0);
        const validatedHours = sRes.reduce((s, r) => {
          const t = ticketByRes[r.id];
          return s + (t && (t.status === "present" || t.status === "late") ? (eventMap[r.event_id]?.counted_duration_hours ?? 0) : 0);
        }, 0);
        return {
          id: p.id,
          name: `${p.last_name} ${p.first_name}`,
          lastName: p.last_name,
          className: classNameMap[classMap[p.id]] ?? "—",
          reservations: sRes.length,
          reservedHours,
          validatedHours,
        };
      }).sort((a, b) => a.lastName.localeCompare(b.lastName));
    },
    enabled: !!sessionId && classIds.length > 0,
  });

  const chartConfig: ChartConfig = {
    reservedHours: { label: "Ore rezervate", color: "hsl(220, 70%, 55%)" },
    validatedHours: { label: "Ore validate", color: "hsl(160, 60%, 40%)" },
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={() => {
          if (!reportData) return;
          exportReportPdf({ title: "Raport clasă", headers: ["Elev", "Clasă", "Rezervări", "Ore rezervate", "Ore validate"],
            rows: reportData.map(s => [s.name, s.className, String(s.reservations), String(s.reservedHours), String(s.validatedHours)]),
            filename: "raport-clasa" });
        }}>
          <Download className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </div>

      {reportData && reportData.length > 0 && (
        <Card className="print:shadow-none print:border-0">
          <CardHeader><CardTitle className="text-base">Ore per elev</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="max-h-[300px]">
              <BarChart data={reportData.slice(0, 20)} layout="vertical">
                <XAxis type="number" allowDecimals={false} />
                <YAxis dataKey="name" type="category" width={120} tick={{ fontSize: 10 }} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="reservedHours" fill="hsl(220, 70%, 55%)" radius={[0, 4, 4, 0]} />
                <Bar dataKey="validatedHours" fill="hsl(160, 60%, 40%)" radius={[0, 4, 4, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-0">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Elev</TableHead>
                <TableHead>Clasă</TableHead>
                <TableHead className="text-right">Rezervări</TableHead>
                <TableHead className="text-right">Ore rezervate</TableHead>
                <TableHead className="text-right">Ore validate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={5} className="text-center">Se încarcă...</TableCell></TableRow>
              ) : reportData?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nu există date.</TableCell></TableRow>
              ) : reportData?.map(s => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.className}</TableCell>
                  <TableCell className="text-right">{s.reservations}</TableCell>
                  <TableCell className="text-right">{s.reservedHours}</TableCell>
                  <TableCell className="text-right">{s.validatedHours}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Tab 2: Situație elevi (Student overview matrix) ─── */
function SituatieEleviTab({ sessionId, classIds, myClasses }: { sessionId: string; classIds: string[]; myClasses: any[] }) {
  const { data, isLoading } = useQuery({
    queryKey: ["teacher-report-situatie", sessionId, classIds],
    queryFn: async () => {
      if (!sessionId || classIds.length === 0) return null;

      const { data: assignments } = await supabase.from("student_class_assignments").select("student_id, class_id").in("class_id", classIds);
      const studentIds = [...new Set((assignments ?? []).map(a => a.student_id))];
      if (studentIds.length === 0) return { students: [], events: [] };

      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", studentIds);
      const { data: events } = await supabase.from("events").select("id, title, date, counted_duration_hours").eq("session_id", sessionId).order("date");
      const eventIds = (events ?? []).map(e => e.id);

      const { data: reservations } = await supabase.from("reservations").select("id, student_id, event_id, status").in("student_id", studentIds);
      const { data: tickets } = await supabase.from("tickets").select("id, reservation_id, status");
      const ticketByRes = Object.fromEntries((tickets ?? []).map(t => [t.reservation_id, t]));

      // Build matrix: student → event → status
      const students = (profiles ?? []).map(p => {
        const eventStatuses: Record<string, string> = {};
        let validatedHours = 0;
        for (const eid of eventIds) {
          const res = (reservations ?? []).find(r => r.student_id === p.id && r.event_id === eid && r.status === "reserved");
          if (!res) {
            eventStatuses[eid] = "none"; // not enrolled
          } else {
            const ticket = ticketByRes[res.id];
            const status = ticket?.status || "reserved";
            eventStatuses[eid] = status;
            if (status === "present" || status === "late") {
              validatedHours += (events ?? []).find(e => e.id === eid)?.counted_duration_hours ?? 0;
            }
          }
        }
        return {
          id: p.id,
          name: `${p.last_name} ${p.first_name}`,
          lastName: p.last_name,
          eventStatuses,
          validatedHours,
        };
      }).sort((a, b) => a.lastName.localeCompare(b.lastName));

      return { students, events: events ?? [] };
    },
    enabled: !!sessionId && classIds.length > 0,
  });

  const statusIcon = (status: string) => {
    switch (status) {
      case "present":
      case "late":
        return <span className="text-green-600 dark:text-green-400 font-bold">✓</span>;
      case "absent":
        return <span className="text-destructive font-bold">✗</span>;
      case "excused":
        return <span className="text-amber-600 dark:text-amber-400 font-bold">M</span>;
      case "reserved":
        return <span className="text-muted-foreground">○</span>;
      default:
        return <span className="text-muted-foreground/50">—</span>;
    }
  };

  const handleExport = () => {
    if (!data?.students.length || !data?.events.length) return;
    const headers = ["Elev", ...data.events.map(e => e.title), "Ore validate"];
    const statusText = (s: string) => {
      if (s === "present" || s === "late") return "P";
      if (s === "absent") return "A";
      if (s === "excused") return "M";
      if (s === "reserved") return "R";
      return "-";
    };
    const rows = data.students.map(st => [
      st.name,
      ...data.events.map(e => statusText(st.eventStatuses[e.id])),
      String(st.validatedHours),
    ]);
    exportReportPdf({
      title: "Situație elevi",
      subtitle: `Clasă: ${myClasses.map(c => c.display_name).join(", ")}`,
      headers,
      rows,
      filename: "situatie-elevi",
      orientation: "landscape",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-between items-center print:hidden">
        <p className="text-sm text-muted-foreground">
          Legendă: <span className="text-green-600 font-bold">✓</span> Prezent &nbsp;
          <span className="text-destructive font-bold">✗</span> Absent &nbsp;
          <span className="text-amber-600 font-bold">M</span> Motivat &nbsp;
          <span className="text-muted-foreground">○</span> Rezervat &nbsp;
          <span className="text-muted-foreground/50">—</span> Neînscris
        </p>
        <Button variant="outline" size="sm" onClick={handleExport}>
          <Download className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-0">
          <div className="overflow-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="sticky left-0 bg-background z-10 min-w-[160px]">Elev</TableHead>
                  {data?.events.map(e => (
                    <TableHead key={e.id} className="text-center min-w-[80px] text-xs whitespace-normal">
                      <div className="truncate max-w-[100px]" title={e.title}>{e.title}</div>
                      <div className="text-[10px] text-muted-foreground">{formatDate(e.date)}</div>
                    </TableHead>
                  ))}
                  <TableHead className="text-right">Ore validate</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={(data?.events.length ?? 0) + 2} className="text-center">Se încarcă...</TableCell></TableRow>
                ) : !data?.students.length ? (
                  <TableRow><TableCell colSpan={(data?.events.length ?? 0) + 2} className="text-center text-muted-foreground">Nu există date.</TableCell></TableRow>
                ) : data.students.map(st => (
                  <TableRow key={st.id}>
                    <TableCell className="sticky left-0 bg-background z-10 font-medium text-sm">{st.name}</TableCell>
                    {data.events.map(e => (
                      <TableCell key={e.id} className="text-center">{statusIcon(st.eventStatuses[e.id])}</TableCell>
                    ))}
                    <TableCell className="text-right font-semibold">{st.validatedHours}h</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

/* ─── Tab 3: Verificare prezență ─── */
function VerificarePrezentaTab({ sessionId, classIds, myClasses }: { sessionId: string; classIds: string[]; myClasses: any[] }) {
  const [filterType, setFilterType] = useState<"event" | "date">("event");
  const [selectedEventId, setSelectedEventId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>("");

  const { data: sessionEvents } = useQuery({
    queryKey: ["teacher-session-events", sessionId],
    queryFn: async () => {
      const { data } = await supabase.from("events").select("id, title, date, start_time, end_time, counted_duration_hours")
        .eq("session_id", sessionId).order("date");
      return data ?? [];
    },
    enabled: !!sessionId,
  });

  const uniqueDates = useMemo(() => {
    const dates = [...new Set((sessionEvents ?? []).map(e => e.date))];
    return dates.sort();
  }, [sessionEvents]);

  const filteredEventIds = useMemo(() => {
    if (filterType === "event" && selectedEventId) return [selectedEventId];
    if (filterType === "date" && selectedDate) return (sessionEvents ?? []).filter(e => e.date === selectedDate).map(e => e.id);
    return [];
  }, [filterType, selectedEventId, selectedDate, sessionEvents]);

  const { data: checkData, isLoading } = useQuery({
    queryKey: ["teacher-report-prezenta", classIds, filteredEventIds],
    queryFn: async () => {
      if (classIds.length === 0 || filteredEventIds.length === 0) return [];

      const { data: assignments } = await supabase.from("student_class_assignments").select("student_id, class_id").in("class_id", classIds);
      const studentIds = [...new Set((assignments ?? []).map(a => a.student_id))];
      if (studentIds.length === 0) return [];

      const { data: profiles } = await supabase.from("profiles").select("id, first_name, last_name").in("id", studentIds);
      const { data: reservations } = await supabase.from("reservations").select("id, student_id, event_id, status").in("student_id", studentIds).in("event_id", filteredEventIds);
      const { data: tickets } = await supabase.from("tickets").select("id, reservation_id, status");
      const ticketByRes = Object.fromEntries((tickets ?? []).map(t => [t.reservation_id, t]));

      const eventMap = Object.fromEntries((sessionEvents ?? []).filter(e => filteredEventIds.includes(e.id)).map(e => [e.id, e]));

      const rows: { id: string; name: string; lastName: string; eventTitle: string; eventDate: string; status: string }[] = [];

      for (const p of (profiles ?? [])) {
        for (const eid of filteredEventIds) {
          const ev = eventMap[eid];
          if (!ev) continue;
          const res = (reservations ?? []).find(r => r.student_id === p.id && r.event_id === eid && r.status === "reserved");
          let status = "Neînscris";
          if (res) {
            const ticket = ticketByRes[res.id];
            const ts = ticket?.status || "reserved";
            if (ts === "present" || ts === "late") status = "Prezent";
            else if (ts === "absent") status = "Absent";
            else if (ts === "excused") status = "Absent motivat";
            else status = "Rezervat";
          }
          rows.push({
            id: `${p.id}-${eid}`,
            name: `${p.last_name} ${p.first_name}`,
            lastName: p.last_name,
            eventTitle: ev.title,
            eventDate: ev.date,
            status,
          });
        }
      }
      return rows.sort((a, b) => a.lastName.localeCompare(b.lastName) || a.eventTitle.localeCompare(b.eventTitle));
    },
    enabled: classIds.length > 0 && filteredEventIds.length > 0,
  });

  const statusBadge = (status: string) => {
    const variant = status === "Prezent" ? "default" : status === "Absent" ? "destructive" : status === "Absent motivat" ? "secondary" : "outline";
    return <Badge variant={variant}>{status}</Badge>;
  };

  const handleExport = () => {
    if (!checkData?.length) return;
    exportReportPdf({
      title: "Verificare prezență",
      subtitle: `Clasă: ${myClasses.map(c => c.display_name).join(", ")}`,
      headers: ["Elev", "Eveniment", "Data", "Status"],
      rows: checkData.map(r => [r.name, r.eventTitle, formatDate(r.eventDate), r.status]),
      filename: "verificare-prezenta",
    });
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 print:hidden">
        <Select value={filterType} onValueChange={(v: "event" | "date") => { setFilterType(v); setSelectedEventId(""); setSelectedDate(""); }}>
          <SelectTrigger className="w-[160px]">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="event">După eveniment</SelectItem>
            <SelectItem value="date">După dată</SelectItem>
          </SelectContent>
        </Select>

        {filterType === "event" ? (
          <Select value={selectedEventId} onValueChange={setSelectedEventId}>
            <SelectTrigger className="w-[260px]">
              <SelectValue placeholder="Selectează evenimentul" />
            </SelectTrigger>
            <SelectContent>
              {sessionEvents?.map(e => (
                <SelectItem key={e.id} value={e.id}>{e.title} ({formatDate(e.date)})</SelectItem>
              ))}
            </SelectContent>
          </Select>
        ) : (
          <Select value={selectedDate} onValueChange={setSelectedDate}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="Selectează data" />
            </SelectTrigger>
            <SelectContent>
              {uniqueDates.map(d => (
                <SelectItem key={d} value={d}>{formatDate(d)}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}

        {checkData && checkData.length > 0 && (
          <Button variant="outline" size="sm" onClick={handleExport} className="ml-auto">
            <Download className="mr-2 h-4 w-4" /> Export PDF
          </Button>
        )}
      </div>

      {filteredEventIds.length === 0 ? (
        <p className="text-muted-foreground text-sm">Selectează un eveniment sau o dată pentru a vedea prezența.</p>
      ) : (
        <Card className="print:shadow-none print:border-0">
          <CardContent className="p-0">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Elev</TableHead>
                  <TableHead>Eveniment</TableHead>
                  <TableHead>Data</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? (
                  <TableRow><TableCell colSpan={4} className="text-center">Se încarcă...</TableCell></TableRow>
                ) : !checkData?.length ? (
                  <TableRow><TableCell colSpan={4} className="text-center text-muted-foreground">Nu există date.</TableCell></TableRow>
                ) : checkData.map(r => (
                  <TableRow key={r.id}>
                    <TableCell className="font-medium">{r.name}</TableCell>
                    <TableCell>{r.eventTitle}</TableCell>
                    <TableCell>{formatDate(r.eventDate)}</TableCell>
                    <TableCell>{statusBadge(r.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
