import { formatDate } from "@/lib/time";
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
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

export default function ReportsPage() {
  const [sessionId, setSessionId] = useState<string>("");

  const { data: sessions } = useQuery({
    queryKey: ["sessions-list"],
    queryFn: async () => {
      const { data } = await supabase.from("program_sessions").select("*").order("start_date", { ascending: false });
      return data ?? [];
    },
  });

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <h1 className="font-display text-2xl font-bold">Rapoarte</h1>
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
        <p className="text-muted-foreground">Selectează o sesiune pentru a vedea rapoartele.</p>
      ) : (
        <Tabs defaultValue="classes">
          <TabsList className="print:hidden">
            <TabsTrigger value="classes">Pe clasă</TabsTrigger>
            <TabsTrigger value="events">Pe eveniment</TabsTrigger>
            <TabsTrigger value="students">Pe elev</TabsTrigger>
          </TabsList>
          <TabsContent value="classes"><ClassReport sessionId={sessionId} /></TabsContent>
          <TabsContent value="events"><EventReport sessionId={sessionId} /></TabsContent>
          <TabsContent value="students"><StudentReport sessionId={sessionId} /></TabsContent>
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
      const sessionReservations = (reservations ?? []).filter(r => eventIds.has(r.event_id));

      const eventMap = Object.fromEntries((events ?? []).map(e => [e.id, e]));
      const ticketByRes = Object.fromEntries((tickets ?? []).map(t => [t.reservation_id, t]));

      return (classes ?? []).map(cls => {
        const studentIds = (assignments ?? []).filter(a => a.class_id === cls.id).map(a => a.student_id);
        const clsReservations = sessionReservations.filter(r => studentIds.includes(r.student_id) && r.status === "reserved");
        const reservedHours = clsReservations.reduce((sum, r) => sum + (eventMap[r.event_id]?.counted_duration_hours ?? 0), 0);
        const validatedHours = clsReservations.reduce((sum, r) => {
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
        <CardContent className="p-0">
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
      const { data: reservations } = await supabase.from("reservations").select("id, event_id, status");
      const { data: tickets } = await supabase.from("tickets").select("id, reservation_id, status");
      const ticketByRes = Object.fromEntries((tickets ?? []).map(t => [t.reservation_id, t]));

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
        <CardContent className="p-0">
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
      const { data: tickets } = await supabase.from("tickets").select("id, reservation_id, status");
      const ticketByRes = Object.fromEntries((tickets ?? []).map(t => [t.reservation_id, t]));
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
          name: p.display_name || `${p.last_name} ${p.first_name}`,
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
      <div className="flex items-center justify-between print:hidden">
        <Select value={classFilter} onValueChange={setClassFilter}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Toate clasele" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate clasele</SelectItem>
            {classes?.map(c => (
              <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Button variant="outline" size="sm" onClick={() => {
          if (!data) return;
          exportReportPdf({ title: "Raport pe elevi", headers: ["Elev", "Clasă", "Rezervări", "Ore rezervate", "Ore validate"],
            rows: data.map(s => [s.name, s.className, String(s.reservations), String(s.reservedHours), String(s.validatedHours)]),
            filename: "raport-elevi" });
        }}>
          <Download className="mr-2 h-4 w-4" /> Export PDF
        </Button>
      </div>
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
