import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Download, Printer } from "lucide-react";
import { exportToCSV } from "@/lib/csv-export";
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

  const classIds = myClasses?.map(c => c.id) ?? [];

  const { data: reportData, isLoading } = useQuery({
    queryKey: ["teacher-report", sessionId, classIds],
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
          name: p.display_name || `${p.last_name} ${p.first_name}`,
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
        <div className="space-y-4">
          <div className="flex justify-end print:hidden">
            <Button variant="outline" size="sm" onClick={() => {
              if (!reportData) return;
              exportToCSV("raport-clasa", ["Elev", "Clasă", "Rezervări", "Ore rezervate", "Ore validate"],
                reportData.map(s => [s.name, s.className, String(s.reservations), String(s.reservedHours), String(s.validatedHours)]));
            }}>
              <Download className="mr-2 h-4 w-4" /> Export CSV
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
      )}
    </div>
  );
}
