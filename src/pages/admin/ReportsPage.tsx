import { formatDate } from "@/lib/time";
import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Printer, BarChart3 } from "lucide-react";
import { exportReportPdf } from "@/lib/report-pdf";
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from "@/components/ui/chart";
import { BarChart, Bar, XAxis, YAxis } from "recharts";

// Batch fetch helper to bypass PostgREST 1000-row limit
async function batchFetch<T = any>(queryFn: (from: number, to: number) => any): Promise<T[]> {
  const batchSize = 1000;
  const all: T[] = [];
  let from = 0;
  while (true) {
    const { data, error } = await queryFn(from, from + batchSize - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < batchSize) break;
    from += batchSize;
  }
  return all;
}

export default function ReportsPage() {
  const [sessionId, setSessionId] = useState<string>("");

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

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <h1 className="font-display text-2xl font-bold">Rapoarte</h1>
        <div className="flex items-center gap-2">
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger className="w-full sm:w-[220px]">
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
        <p className="text-muted-foreground">Selectează o sesiune pentru a vedea rapoartele.</p>
      ) : (
        <Tabs defaultValue="classes">
          <TabsList className="print:hidden w-full sm:w-auto flex-wrap h-auto">
            <TabsTrigger value="classes" className="flex-1 sm:flex-none">Pe clasă</TabsTrigger>
            <TabsTrigger value="events" className="flex-1 sm:flex-none">Pe eveniment</TabsTrigger>
            <TabsTrigger value="students" className="flex-1 sm:flex-none">Pe elev</TabsTrigger>
            <TabsTrigger value="feedback" className="flex-1 sm:flex-none">Feedback</TabsTrigger>
            <TabsTrigger value="clubs" className="flex-1 sm:flex-none">Cluburi</TabsTrigger>
            <TabsTrigger value="volunteers" className="flex-1 sm:flex-none">Voluntariat</TabsTrigger>
          </TabsList>
          <TabsContent value="classes"><ClassReport sessionId={sessionId} /></TabsContent>
          <TabsContent value="events"><EventReport sessionId={sessionId} /></TabsContent>
          <TabsContent value="students"><StudentReport sessionId={sessionId} /></TabsContent>
          <TabsContent value="feedback"><FeedbackReport sessionId={sessionId} /></TabsContent>
          <TabsContent value="clubs"><ClubsReport sessionId={sessionId} /></TabsContent>
          <TabsContent value="volunteers"><VolunteersReport sessionId={sessionId} /></TabsContent>
        </Tabs>
      )}
    </div>
  );
}

function ClassReport({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-classes", sessionId],
    queryFn: async () => {
      const { data: classes } = await supabase.from("classes").select("id, display_name, grade_number").eq("is_active", true).order("grade_number");

      // Batch fetch to handle >1000 rows
      const batchFetch = async (query: () => ReturnType<typeof supabase.from>) => {
        const batchSize = 1000;
        let all: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await (query() as any).range(from, from + batchSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < batchSize) break;
          from += batchSize;
        }
        return all;
      };

      const assignments = await batchFetch(() => supabase.from("student_class_assignments").select("student_id, class_id") as any);
      const reservations = await batchFetch(() => supabase.from("reservations").select("id, student_id, status, event_id") as any);
      const { data: events } = await supabase.from("events").select("id, session_id, counted_duration_hours").eq("session_id", sessionId);
      const tickets = await batchFetch(() => supabase.from("tickets").select("id, reservation_id, status") as any);

      const eventIds = new Set((events ?? []).map(e => e.id));
      const sessionReservations = reservations.filter((r: any) => eventIds.has(r.event_id));

      const eventMap = Object.fromEntries((events ?? []).map(e => [e.id, e]));
      const ticketByRes = Object.fromEntries(tickets.map((t: any) => [t.reservation_id, t]));

      return (classes ?? []).map(cls => {
        const studentIds = assignments.filter((a: any) => a.class_id === cls.id).map((a: any) => a.student_id);
        const clsReservations = sessionReservations.filter((r: any) => studentIds.includes(r.student_id) && r.status === "reserved");
        const reservedHours = clsReservations.reduce((sum: number, r: any) => sum + (eventMap[r.event_id]?.counted_duration_hours ?? 0), 0);
        const validatedHours = clsReservations.reduce((sum: number, r: any) => {
          const t = ticketByRes[r.id];
          return sum + (t && (t.status === "present" || t.status === "late") ? (eventMap[r.event_id]?.counted_duration_hours ?? 0) : 0);
        }, 0);
        return { ...cls, students: studentIds.length, reservedHours, validatedHours };
      });
    },
  });

  const chartConfig: ChartConfig = {
    reservedHours: { label: "Ore rezervate", color: "hsl(220, 70%, 55%)" },
    validatedHours: { label: "Ore validate", color: "hsl(160, 60%, 40%)" },
  };

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={() => {
          if (!data) return;
          exportReportPdf({ title: "Raport pe clase", headers: ["Clasă", "Elevi", "Ore rezervate", "Ore validate"],
            rows: data.map(c => [c.display_name, String(c.students), String(c.reservedHours), String(c.validatedHours)]),
            filename: "raport-clase" });
        }}>
          <Download className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </div>
      {data && data.length > 0 && (
        <Card className="print:shadow-none print:border-0">
          <CardHeader><CardTitle className="text-base">Ore per clasă</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="max-h-[300px]">
              <BarChart data={data}>
                <XAxis dataKey="display_name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="reservedHours" fill="hsl(220, 70%, 55%)" radius={[4, 4, 0, 0]} />
                <Bar dataKey="validatedHours" fill="hsl(160, 60%, 40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Clasă</TableHead>
                <TableHead className="text-right">Elevi</TableHead>
                <TableHead className="text-right">Ore rezervate</TableHead>
                <TableHead className="text-right">Ore validate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={4} className="text-center">Se încarcă...</TableCell></TableRow>
              ) : data?.map(c => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.display_name}</TableCell>
                  <TableCell className="text-right">{c.students}</TableCell>
                  <TableCell className="text-right">{c.reservedHours}</TableCell>
                  <TableCell className="text-right">{c.validatedHours}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function EventReport({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-events", sessionId],
    queryFn: async () => {
      const { data: events } = await supabase.from("events").select("*").eq("session_id", sessionId).order("date");

      // Batch fetch reservations and tickets (can exceed 1000 rows)
      const batchFetchAny = async (queryFn: (from: number, to: number) => any) => {
        const batchSize = 1000;
        let all: any[] = [];
        let from = 0;
        while (true) {
          const { data, error } = await queryFn(from, from + batchSize - 1);
          if (error) throw error;
          if (!data || data.length === 0) break;
          all.push(...data);
          if (data.length < batchSize) break;
          from += batchSize;
        }
        return all;
      };

      const reservations = await batchFetchAny((f, t) => supabase.from("reservations").select("id, event_id, status").range(f, t));
      const tickets = await batchFetchAny((f, t) => supabase.from("tickets").select("id, reservation_id, status").range(f, t));
      const ticketByRes = Object.fromEntries(tickets.map((t: any) => [t.reservation_id, t]));

      // Get public data
      const eventIds = (events ?? []).map(e => e.id);
      const { data: publicRes } = await supabase.from("public_reservations").select("id, event_id, status");
      const { data: publicTickets } = await supabase.from("public_tickets").select("id, public_reservation_id, status");
      
      const publicResByEvent = new Map<string, any[]>();
      (publicRes ?? []).filter(pr => eventIds.includes(pr.event_id) && pr.status === "reserved").forEach(pr => {
        if (!publicResByEvent.has(pr.event_id)) publicResByEvent.set(pr.event_id, []);
        publicResByEvent.get(pr.event_id)!.push(pr);
      });
      const publicTicketByRes = Object.fromEntries((publicTickets ?? []).map(t => [t.public_reservation_id, t]));

      return (events ?? []).map(e => {
        const evRes = (reservations ?? []).filter(r => r.event_id === e.id && r.status === "reserved");
        const present = evRes.filter(r => ticketByRes[r.id]?.status === "present").length;
        const late = evRes.filter(r => ticketByRes[r.id]?.status === "late").length;
        const absent = evRes.filter(r => ticketByRes[r.id]?.status === "absent").length;

        // Public counts
        const pubRes = publicResByEvent.get(e.id) ?? [];
        const pubTickets = pubRes.map(pr => publicTicketByRes[pr.id]).filter(Boolean);
        const pubPresent = pubTickets.filter(t => t.status === "present").length;
        const pubLate = pubTickets.filter(t => t.status === "late").length;
        const pubAbsent = pubTickets.filter(t => t.status === "absent").length;
        const pubTotal = pubTickets.length;

        const totalReserved = evRes.length + pubTotal;
        return {
          ...e,
          reserved: totalReserved,
          present: present + pubPresent,
          late: late + pubLate,
          absent: absent + pubAbsent,
          guests: pubTotal,
          fillRate: e.max_capacity > 0 ? Math.round(totalReserved / e.max_capacity * 100) : 0,
        };
      });
    },
  });

  return (
    <div className="space-y-4">
      <div className="flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={() => {
          if (!data) return;
          exportReportPdf({ title: "Raport pe evenimente", headers: ["Eveniment", "Data", "Rezervări", "Vizitatori", "Capacitate", "% Ocupare", "Prezenți", "Întârziați", "Absenți"],
            rows: data.map(e => [e.title, formatDate(e.date), String(e.reserved), String(e.guests), String(e.max_capacity), `${e.fillRate}%`, String(e.present), String(e.late), String(e.absent)]),
            filename: "raport-evenimente", orientation: "landscape" });
        }}>
          <Download className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </div>
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Eveniment</TableHead>
                <TableHead>Data</TableHead>
                <TableHead className="text-right">Rezervări</TableHead>
                <TableHead className="text-right">Vizitatori</TableHead>
                <TableHead className="text-right">Capacitate</TableHead>
                <TableHead className="text-right">% Ocupare</TableHead>
                <TableHead className="text-right">Prezenți</TableHead>
                <TableHead className="text-right">Întârziați</TableHead>
                <TableHead className="text-right">Absenți</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center">Se încarcă...</TableCell></TableRow>
              ) : data?.map(e => (
                <TableRow key={e.id}>
                  <TableCell className="font-medium">
                    {e.title}
                    {(e as any).is_public && <Badge variant="outline" className="ml-2 text-[10px]">Public</Badge>}
                  </TableCell>
                  <TableCell>{formatDate(e.date)}</TableCell>
                  <TableCell className="text-right">{e.reserved}</TableCell>
                  <TableCell className="text-right">{e.guests}</TableCell>
                  <TableCell className="text-right">{e.max_capacity}</TableCell>
                  <TableCell className="text-right">
                    <Badge variant={e.fillRate >= 90 ? "destructive" : e.fillRate >= 70 ? "secondary" : "outline"}>
                      {e.fillRate}%
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{e.present}</TableCell>
                  <TableCell className="text-right">{e.late}</TableCell>
                  <TableCell className="text-right">{e.absent}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

function StudentReport({ sessionId }: { sessionId: string }) {
  const [classFilter, setClassFilter] = useState<string>("all");

  const { data: classes } = useQuery({
    queryKey: ["classes-for-filter"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id, display_name").eq("is_active", true).order("display_name");
      return data ?? [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["report-students", sessionId, classFilter],
    queryFn: async () => {
      let assignmentQuery = supabase.from("student_class_assignments").select("student_id, class_id");
      if (classFilter !== "all") assignmentQuery = assignmentQuery.eq("class_id", classFilter);
      const { data: assignments } = await assignmentQuery;

      const studentIds = [...new Set((assignments ?? []).map(a => a.student_id))];
      if (studentIds.length === 0) return [];

      const { data: profiles } = await supabase.from("profiles").select("id, display_name, first_name, last_name").in("id", studentIds);
      const { data: events } = await supabase.from("events").select("id, counted_duration_hours, session_id").eq("session_id", sessionId);
      const eventIds = (events ?? []).map(e => e.id);
      const eventMap = Object.fromEntries((events ?? []).map(e => [e.id, e]));
      
      const { data: reservations } = await supabase.from("reservations").select("id, student_id, event_id, status").in("student_id", studentIds);
      // Batch fetch tickets (can exceed 1000)
      const batchSize = 1000;
      let allTickets: any[] = [];
      let tFrom = 0;
      while (true) {
        const { data: tData, error: tErr } = await supabase.from("tickets").select("id, reservation_id, status").range(tFrom, tFrom + batchSize - 1);
        if (tErr) throw tErr;
        if (!tData || tData.length === 0) break;
        allTickets.push(...tData);
        if (tData.length < batchSize) break;
        tFrom += batchSize;
      }
      const ticketByRes = Object.fromEntries(allTickets.map((t: any) => [t.reservation_id, t]));
      const classMap = Object.fromEntries((assignments ?? []).map(a => [a.student_id, a.class_id]));
      const classNameMap = Object.fromEntries((classes ?? []).map(c => [c.id, c.display_name]));

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
  });

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between print:hidden">
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Toate clasele" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate clasele</SelectItem>
            {classes?.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" className="w-full sm:w-auto" onClick={() => {
          if (!data) return;
          exportReportPdf({ title: "Raport pe elevi", headers: ["Elev", "Clasă", "Rezervări", "Ore rezervate", "Ore validate"],
            rows: data.map(s => [s.name, s.className, String(s.reservations), String(s.reservedHours), String(s.validatedHours)]),
            filename: "raport-elevi" });
        }}>
          <Download className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </div>
      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-0 overflow-x-auto">
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
              ) : data?.length === 0 ? (
                <TableRow><TableCell colSpan={5} className="text-center text-muted-foreground">Nu există elevi.</TableCell></TableRow>
              ) : data?.map(s => (
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

// ============================================================
// FEEDBACK REPORT
// ============================================================
function FeedbackReport({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-feedback", sessionId],
    queryFn: async () => {
      const { data: forms } = await supabase
        .from("feedback_forms")
        .select("*")
        .eq("session_id", sessionId)
        .order("created_at", { ascending: false });

      const formIds = (forms ?? []).map((f) => f.id);
      if (formIds.length === 0) return [];

      const questions = await batchFetch<any>((f, t) =>
        supabase.from("feedback_questions").select("id, form_id").in("form_id", formIds).range(f, t)
      );
      const responses = await batchFetch<any>((f, t) =>
        supabase.from("feedback_responses").select("id, form_id, is_identified").in("form_id", formIds).range(f, t)
      );

      const qCount = new Map<string, number>();
      questions.forEach((q) => qCount.set(q.form_id, (qCount.get(q.form_id) ?? 0) + 1));
      const rCount = new Map<string, number>();
      const rIdent = new Map<string, number>();
      responses.forEach((r) => {
        rCount.set(r.form_id, (rCount.get(r.form_id) ?? 0) + 1);
        if (r.is_identified) rIdent.set(r.form_id, (rIdent.get(r.form_id) ?? 0) + 1);
      });

      return (forms ?? []).map((f: any) => ({
        id: f.id,
        title: f.title,
        type: f.type,
        audience: f.audience,
        status: f.status,
        anonymity: f.anonymity,
        opens_at: f.opens_at,
        closes_at: f.closes_at,
        questions: qCount.get(f.id) ?? 0,
        responses: rCount.get(f.id) ?? 0,
        identified: rIdent.get(f.id) ?? 0,
      }));
    },
  });

  const typeLabels: Record<string, string> = {
    general: "General",
    teacher_feedback: "Feedback profesori",
    event_feedback: "Feedback eveniment",
  };
  const audienceLabels: Record<string, string> = { students: "Elevi", teachers: "Profesori" };
  const statusLabels: Record<string, string> = { draft: "Ciornă", active: "Activ", closed: "Închis" };
  const anonLabels: Record<string, string> = {
    anonymous: "Anonim",
    identified: "Identificat",
    optional: "Opțional",
  };

  const totalResponses = (data ?? []).reduce((s, f) => s + f.responses, 0);
  const top = [...(data ?? [])].sort((a, b) => b.responses - a.responses).slice(0, 5);
  const chartConfig: ChartConfig = { responses: { label: "Răspunsuri", color: "hsl(220, 70%, 55%)" } };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Chestionare</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{data?.length ?? "—"}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Răspunsuri totale</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalResponses}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Chestionare active</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{(data ?? []).filter((f) => f.status === "active").length}</p></CardContent></Card>
      </div>

      {top.length > 0 && top[0].responses > 0 && (
        <Card className="print:shadow-none print:border-0">
          <CardHeader><CardTitle className="text-base">Top chestionare după răspunsuri</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="max-h-[260px]">
              <BarChart data={top}>
                <XAxis dataKey="title" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="responses" fill="hsl(220, 70%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={() => {
          if (!data) return;
          exportReportPdf({
            title: "Raport chestionare feedback",
            headers: ["Titlu", "Tip", "Audiență", "Status", "Anonimitate", "Întrebări", "Răspunsuri", "Identificați"],
            rows: data.map((f) => [
              f.title,
              typeLabels[f.type] ?? f.type,
              audienceLabels[f.audience] ?? f.audience,
              statusLabels[f.status] ?? f.status,
              anonLabels[f.anonymity] ?? f.anonymity,
              String(f.questions),
              String(f.responses),
              String(f.identified),
            ]),
            filename: "raport-feedback",
            orientation: "landscape",
          });
        }}>
          <Download className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Titlu</TableHead>
                <TableHead>Tip</TableHead>
                <TableHead>Audiență</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Anonimitate</TableHead>
                <TableHead className="text-right">Întrebări</TableHead>
                <TableHead className="text-right">Răspunsuri</TableHead>
                <TableHead className="text-right">Identificați</TableHead>
                <TableHead className="print:hidden"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={9} className="text-center">Se încarcă...</TableCell></TableRow>
              ) : (data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={9} className="text-center text-muted-foreground">Nu există chestionare în această sesiune.</TableCell></TableRow>
              ) : data!.map((f) => (
                <TableRow key={f.id}>
                  <TableCell className="font-medium">{f.title}</TableCell>
                  <TableCell>{typeLabels[f.type] ?? f.type}</TableCell>
                  <TableCell>{audienceLabels[f.audience] ?? f.audience}</TableCell>
                  <TableCell>
                    <Badge variant={f.status === "active" ? "default" : f.status === "closed" ? "secondary" : "outline"}>
                      {statusLabels[f.status] ?? f.status}
                    </Badge>
                  </TableCell>
                  <TableCell>{anonLabels[f.anonymity] ?? f.anonymity}</TableCell>
                  <TableCell className="text-right">{f.questions}</TableCell>
                  <TableCell className="text-right font-medium">{f.responses}</TableCell>
                  <TableCell className="text-right">{f.identified}</TableCell>
                  <TableCell className="print:hidden">
                    <Button asChild variant="ghost" size="sm">
                      <Link to={`/admin/feedback/${f.id}/report`}><BarChart3 className="h-4 w-4 mr-1" /> Raport</Link>
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// CLUBS REPORT
// ============================================================
function ClubsReport({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-clubs", sessionId],
    queryFn: async () => {
      const { data: clubs } = await supabase
        .from("clubs")
        .select("*")
        .eq("session_id", sessionId)
        .order("name");

      const clubIds = (clubs ?? []).map((c) => c.id);
      if (clubIds.length === 0) return [];

      const enrollments = await batchFetch<any>((f, t) =>
        supabase.from("club_enrollments").select("club_id, student_id, status").in("club_id", clubIds).range(f, t)
      );
      const meetings = await batchFetch<any>((f, t) =>
        supabase.from("club_meetings").select("id, club_id").in("club_id", clubIds).range(f, t)
      );
      const meetingIds = meetings.map((m) => m.id);
      const attendance = meetingIds.length
        ? await batchFetch<any>((f, t) =>
            supabase.from("club_attendance").select("meeting_id, status").in("meeting_id", meetingIds).range(f, t)
          )
        : [];

      const meetingToClub = new Map(meetings.map((m) => [m.id, m.club_id]));

      return (clubs ?? []).map((c: any) => {
        const enr = enrollments.filter((e) => e.club_id === c.id && e.status === "enrolled");
        const mtgs = meetings.filter((m) => m.club_id === c.id);
        const att = attendance.filter((a) => meetingToClub.get(a.meeting_id) === c.id);
        const present = att.filter((a) => a.status === "present" || a.status === "late").length;
        const heldMeetings = new Set(att.filter((a) => a.status === "present" || a.status === "late").map((a) => a.meeting_id)).size;
        return {
          id: c.id,
          name: c.name,
          status: c.status,
          enrolled: enr.length,
          capacity: c.max_capacity ?? 0,
          fillRate: c.max_capacity ? Math.round((enr.length / c.max_capacity) * 100) : 0,
          meetingsTotal: mtgs.length,
          meetingsHeld: heldMeetings,
          attendanceRate: att.length ? Math.round((present / att.length) * 100) : 0,
        };
      });
    },
  });

  const statusLabels: Record<string, string> = { draft: "Ciornă", active: "Activ", closed: "Închis" };
  const totals = {
    active: (data ?? []).filter((c) => c.status === "active").length,
    enrolled: (data ?? []).reduce((s, c) => s + c.enrolled, 0),
    held: (data ?? []).reduce((s, c) => s + c.meetingsHeld, 0),
  };
  const top = [...(data ?? [])].sort((a, b) => b.enrolled - a.enrolled).slice(0, 10);
  const chartConfig: ChartConfig = { enrolled: { label: "Înscriși", color: "hsl(220, 70%, 55%)" } };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Cluburi active</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totals.active}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Total înscrieri</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totals.enrolled}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Întâlniri ținute</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totals.held}</p></CardContent></Card>
      </div>

      {top.length > 0 && top[0].enrolled > 0 && (
        <Card className="print:shadow-none print:border-0">
          <CardHeader><CardTitle className="text-base">Înscriși per club (top 10)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="max-h-[260px]">
              <BarChart data={top}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="enrolled" fill="hsl(220, 70%, 55%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={() => {
          if (!data) return;
          exportReportPdf({
            title: "Raport cluburi",
            headers: ["Club", "Status", "Înscriși", "Capacitate", "% Ocupare", "Întâlniri", "Ținute", "% Prezență"],
            rows: data.map((c) => [
              c.name,
              statusLabels[c.status] ?? c.status,
              String(c.enrolled),
              c.capacity ? String(c.capacity) : "—",
              c.capacity ? `${c.fillRate}%` : "—",
              String(c.meetingsTotal),
              String(c.meetingsHeld),
              `${c.attendanceRate}%`,
            ]),
            filename: "raport-cluburi",
            orientation: "landscape",
          });
        }}>
          <Download className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Club</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Înscriși</TableHead>
                <TableHead className="text-right">Capacitate</TableHead>
                <TableHead className="text-right">% Ocupare</TableHead>
                <TableHead className="text-right">Întâlniri</TableHead>
                <TableHead className="text-right">Ținute</TableHead>
                <TableHead className="text-right">% Prezență</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center">Se încarcă...</TableCell></TableRow>
              ) : (data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nu există cluburi în această sesiune.</TableCell></TableRow>
              ) : data!.map((c) => (
                <TableRow key={c.id}>
                  <TableCell className="font-medium">{c.name}</TableCell>
                  <TableCell>
                    <Badge variant={c.status === "active" ? "default" : c.status === "closed" ? "secondary" : "outline"}>
                      {statusLabels[c.status] ?? c.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{c.enrolled}</TableCell>
                  <TableCell className="text-right">{c.capacity || "—"}</TableCell>
                  <TableCell className="text-right">
                    {c.capacity ? (
                      <Badge variant={c.fillRate >= 90 ? "destructive" : c.fillRate >= 70 ? "secondary" : "outline"}>
                        {c.fillRate}%
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right">{c.meetingsTotal}</TableCell>
                  <TableCell className="text-right">{c.meetingsHeld}</TableCell>
                  <TableCell className="text-right">{c.attendanceRate}%</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}

// ============================================================
// VOLUNTEERS REPORT
// ============================================================
function hoursBetween(start: string, end: string): number {
  // "HH:MM:SS" or "HH:MM"
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const mins = (eh * 60 + (em || 0)) - (sh * 60 + (sm || 0));
  return Math.max(0, Math.round(mins / 60));
}

function VolunteersReport({ sessionId }: { sessionId: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ["report-volunteers", sessionId],
    queryFn: async () => {
      const { data: projects } = await supabase
        .from("volunteer_projects")
        .select("*")
        .eq("session_id", sessionId)
        .order("name");

      const projIds = (projects ?? []).map((p) => p.id);
      if (projIds.length === 0) return [];

      const enrollments = await batchFetch<any>((f, t) =>
        supabase.from("volunteer_enrollments").select("project_id, student_id, status").in("project_id", projIds).range(f, t)
      );
      const days = await batchFetch<any>((f, t) =>
        supabase.from("volunteer_days").select("id, project_id, start_time, end_time").in("project_id", projIds).range(f, t)
      );
      const dayIds = days.map((d) => d.id);
      const attendance = dayIds.length
        ? await batchFetch<any>((f, t) =>
            supabase.from("volunteer_attendance").select("day_id, student_id, status").in("day_id", dayIds).range(f, t)
          )
        : [];

      const dayMap = new Map(days.map((d) => [d.id, d]));

      return (projects ?? []).map((p: any) => {
        const enr = enrollments.filter((e) => e.project_id === p.id && e.status === "enrolled");
        const projDays = days.filter((d) => d.project_id === p.id);
        const projAtt = attendance.filter((a) => {
          const d = dayMap.get(a.day_id) as any;
          return d && d.project_id === p.id && (a.status === "present" || a.status === "late");
        });
        const totalHours = projAtt.reduce((sum, a) => {
          const d = dayMap.get(a.day_id) as any;
          return d ? sum + hoursBetween(d.start_time, d.end_time) : sum;
        }, 0);
        const activeVolunteers = new Set(projAtt.map((a) => a.student_id)).size;
        return {
          id: p.id,
          name: p.name,
          status: p.status,
          enrolled: enr.length,
          capacity: p.max_capacity ?? 0,
          fillRate: p.max_capacity ? Math.round((enr.length / p.max_capacity) * 100) : 0,
          daysTotal: projDays.length,
          totalHours,
          activeVolunteers,
        };
      });
    },
  });

  const statusLabels: Record<string, string> = { draft: "Ciornă", active: "Activ", closed: "Închis" };
  const totals = {
    active: (data ?? []).filter((p) => p.status === "active").length,
    volunteers: new Set((data ?? []).flatMap((_) => [])).size, // placeholder
    hours: (data ?? []).reduce((s, p) => s + p.totalHours, 0),
  };
  const totalUniqueVolunteers = (data ?? []).reduce((s, p) => s + p.activeVolunteers, 0);
  const top = [...(data ?? [])].sort((a, b) => b.totalHours - a.totalHours).slice(0, 10);
  const chartConfig: ChartConfig = { totalHours: { label: "Ore validate", color: "hsl(160, 60%, 40%)" } };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Proiecte active</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totals.active}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Voluntari (cu prezență)</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totalUniqueVolunteers}</p></CardContent></Card>
        <Card><CardHeader className="pb-2"><CardTitle className="text-sm text-muted-foreground">Ore validate</CardTitle></CardHeader><CardContent><p className="text-2xl font-bold">{totals.hours}h</p></CardContent></Card>
      </div>

      {top.length > 0 && top[0].totalHours > 0 && (
        <Card className="print:shadow-none print:border-0">
          <CardHeader><CardTitle className="text-base">Ore validate per proiect (top 10)</CardTitle></CardHeader>
          <CardContent>
            <ChartContainer config={chartConfig} className="max-h-[260px]">
              <BarChart data={top}>
                <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                <YAxis allowDecimals={false} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="totalHours" fill="hsl(160, 60%, 40%)" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ChartContainer>
          </CardContent>
        </Card>
      )}

      <div className="flex justify-end print:hidden">
        <Button variant="outline" size="sm" onClick={() => {
          if (!data) return;
          exportReportPdf({
            title: "Raport voluntariat",
            headers: ["Proiect", "Status", "Înscriși", "Capacitate", "% Ocupare", "Zile", "Voluntari activi", "Ore validate"],
            rows: data.map((p) => [
              p.name,
              statusLabels[p.status] ?? p.status,
              String(p.enrolled),
              p.capacity ? String(p.capacity) : "—",
              p.capacity ? `${p.fillRate}%` : "—",
              String(p.daysTotal),
              String(p.activeVolunteers),
              `${p.totalHours}h`,
            ]),
            filename: "raport-voluntariat",
            orientation: "landscape",
          });
        }}>
          <Download className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </div>

      <Card className="print:shadow-none print:border-0">
        <CardContent className="p-0 overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Proiect</TableHead>
                <TableHead>Status</TableHead>
                <TableHead className="text-right">Înscriși</TableHead>
                <TableHead className="text-right">Capacitate</TableHead>
                <TableHead className="text-right">% Ocupare</TableHead>
                <TableHead className="text-right">Zile</TableHead>
                <TableHead className="text-right">Voluntari activi</TableHead>
                <TableHead className="text-right">Ore validate</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8} className="text-center">Se încarcă...</TableCell></TableRow>
              ) : (data ?? []).length === 0 ? (
                <TableRow><TableCell colSpan={8} className="text-center text-muted-foreground">Nu există proiecte de voluntariat în această sesiune.</TableCell></TableRow>
              ) : data!.map((p) => (
                <TableRow key={p.id}>
                  <TableCell className="font-medium">{p.name}</TableCell>
                  <TableCell>
                    <Badge variant={p.status === "active" ? "default" : p.status === "closed" ? "secondary" : "outline"}>
                      {statusLabels[p.status] ?? p.status}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right">{p.enrolled}</TableCell>
                  <TableCell className="text-right">{p.capacity || "—"}</TableCell>
                  <TableCell className="text-right">
                    {p.capacity ? (
                      <Badge variant={p.fillRate >= 90 ? "destructive" : p.fillRate >= 70 ? "secondary" : "outline"}>
                        {p.fillRate}%
                      </Badge>
                    ) : "—"}
                  </TableCell>
                  <TableCell className="text-right">{p.daysTotal}</TableCell>
                  <TableCell className="text-right">{p.activeVolunteers}</TableCell>
                  <TableCell className="text-right font-medium">{p.totalHours}h</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
