import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Search, Users, CalendarDays, Clock, ChevronRight, Download, Printer, KeyRound } from "lucide-react";
import { exportToCSV } from "@/lib/csv-export";
import { toast } from "sonner";

interface StudentReport {
  id: string;
  name: string;
  reservations: { eventTitle: string; date: string; hours: number; status: string }[];
  totalReservedHours: number;
  totalValidatedHours: number;
}

export default function TeacherDashboard() {
  const { user, profile } = useAuth();
  const [search, setSearch] = useState("");
  const [sessionId, setSessionId] = useState("");
  const [selectedStudent, setSelectedStudent] = useState<StudentReport | null>(null);

  const { data: myClasses = [] } = useQuery({
    queryKey: ["teacher_classes", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, display_name, grade_number, section")
        .eq("homeroom_teacher_id", user!.id)
        .eq("is_active", true)
        .order("grade_number");
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["sessions_list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_sessions")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const classIds = myClasses.map((c) => c.id);

  const { data: reportData = [], isLoading } = useQuery({
    queryKey: ["teacher_dashboard_report", sessionId, classIds],
    queryFn: async () => {
      if (!sessionId || classIds.length === 0) return [];

      // Get students in my classes
      const { data: assignments } = await supabase
        .from("student_class_assignments")
        .select("student_id, class_id")
        .in("class_id", classIds);
      const studentIds = [...new Set((assignments ?? []).map((a) => a.student_id))];
      if (studentIds.length === 0) return [];

      // Get profiles
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, display_name, first_name, last_name")
        .in("id", studentIds);

      // Get events for this session
      const { data: events } = await supabase
        .from("events")
        .select("id, title, date, counted_duration_hours")
        .eq("session_id", sessionId);
      const eventMap = Object.fromEntries((events ?? []).map((e) => [e.id, e]));
      const eventIds = (events ?? []).map((e) => e.id);

      // Get reservations
      const { data: reservations } = await supabase
        .from("reservations")
        .select("id, student_id, event_id, status")
        .in("student_id", studentIds)
        .eq("status", "reserved");

      // Get tickets
      const { data: tickets } = await supabase
        .from("tickets")
        .select("id, reservation_id, status");
      const ticketByRes = Object.fromEntries((tickets ?? []).map((t) => [t.reservation_id, t]));

      // Build report
      return (profiles ?? []).map((p) => {
        const studentRes = (reservations ?? []).filter(
          (r) => r.student_id === p.id && eventIds.includes(r.event_id)
        );
        const reservationDetails = studentRes.map((r) => {
          const ev = eventMap[r.event_id];
          const ticket = ticketByRes[r.id];
          return {
            eventTitle: ev?.title || "—",
            date: ev?.date || "—",
            hours: ev?.counted_duration_hours || 0,
            status: ticket?.status || "reserved",
          };
        });
        const totalReservedHours = reservationDetails.reduce((s, r) => s + r.hours, 0);
        const totalValidatedHours = reservationDetails
          .filter((r) => r.status === "present" || r.status === "late")
          .reduce((s, r) => s + r.hours, 0);

        return {
          id: p.id,
          name: p.display_name || `${p.first_name} ${p.last_name}`,
          reservations: reservationDetails,
          totalReservedHours,
          totalValidatedHours,
        } as StudentReport;
      }).sort((a, b) => a.name.localeCompare(b.name));
    },
    enabled: !!sessionId && classIds.length > 0,
  });

  const filtered = reportData.filter(
    (s) => !search || s.name.toLowerCase().includes(search.toLowerCase())
  );

  const statusLabels: Record<string, string> = {
    reserved: "Rezervat", present: "Prezent", late: "Întârziat",
    absent: "Absent", excused: "Motivat",
  };

  return (
    <div className="space-y-6 print:space-y-4">
      <div className="flex items-center justify-between print:hidden">
        <div>
          <h1 className="font-display text-2xl font-bold">Clasa mea</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            {myClasses.length > 0
              ? `Diriginte: ${myClasses.map((c) => c.display_name).join(", ")}`
              : "Nu ai nicio clasă asignată."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Select value={sessionId} onValueChange={setSessionId}>
            <SelectTrigger className="w-[220px]">
              <SelectValue placeholder="Selectează sesiunea" />
            </SelectTrigger>
            <SelectContent>
              {sessions.map((s) => (
                <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {myClasses.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Users className="mx-auto mb-2 h-8 w-8" />
            <p>Nu ai nicio clasă asignată. Contactează administratorul.</p>
          </CardContent>
        </Card>
      ) : !sessionId ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            Selectează o sesiune pentru a vedea situația elevilor.
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Stats */}
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Users className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">{reportData.length}</p>
                  <p className="text-xs text-muted-foreground">Elevi în clasă</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <CalendarDays className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">
                    {reportData.reduce((s, r) => s + r.reservations.length, 0)}
                  </p>
                  <p className="text-xs text-muted-foreground">Înscrierea totale</p>
                </div>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="flex items-center gap-3 p-4">
                <Clock className="h-8 w-8 text-primary" />
                <div>
                  <p className="text-2xl font-bold">
                    {reportData.reduce((s, r) => s + r.totalValidatedHours, 0)}h
                  </p>
                  <p className="text-xs text-muted-foreground">Ore validate total</p>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Filters & Export */}
          <div className="flex items-center gap-3 print:hidden">
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input placeholder="Caută elev…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
            </div>
            <Button variant="outline" size="sm" onClick={() => {
              exportToCSV("raport-clasa", ["Elev", "Nr. înscrierea", "Ore rezervate", "Ore validate"],
                reportData.map((s) => [s.name, String(s.reservations.length), String(s.totalReservedHours), String(s.totalValidatedHours)]));
            }}>
              <Download className="mr-2 h-4 w-4" /> CSV
            </Button>
            <Button variant="outline" size="sm" onClick={() => window.print()}>
              <Printer className="mr-2 h-4 w-4" /> Print
            </Button>
          </div>

          {/* Student Table */}
          <Card className="print:shadow-none print:border-0">
            <CardContent className="p-0">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Elev</TableHead>
                    <TableHead className="text-right">Înscrierea</TableHead>
                    <TableHead className="text-right">Ore rezervate</TableHead>
                    <TableHead className="text-right">Ore validate</TableHead>
                    <TableHead className="w-10 print:hidden"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Se încarcă…</TableCell></TableRow>
                  ) : filtered.length === 0 ? (
                    <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Niciun elev găsit.</TableCell></TableRow>
                  ) : filtered.map((s) => (
                    <TableRow key={s.id} className="cursor-pointer hover:bg-muted/50" onClick={() => setSelectedStudent(s)}>
                      <TableCell className="font-medium">{s.name}</TableCell>
                      <TableCell className="text-right">{s.reservations.length}</TableCell>
                      <TableCell className="text-right">{s.totalReservedHours}h</TableCell>
                      <TableCell className="text-right">
                        <span className={s.totalValidatedHours > 0 ? "text-green-700 dark:text-green-400 font-semibold" : ""}>
                          {s.totalValidatedHours}h
                        </span>
                      </TableCell>
                      <TableCell className="print:hidden">
                        <ChevronRight className="h-4 w-4 text-muted-foreground" />
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </CardContent>
          </Card>
        </>
      )}

      {/* Student Detail Dialog */}
      <Dialog open={!!selectedStudent} onOpenChange={(o) => !o && setSelectedStudent(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{selectedStudent?.name}</DialogTitle>
            <DialogDescription>
              {selectedStudent?.totalReservedHours}h rezervate • {selectedStudent?.totalValidatedHours}h validate • {selectedStudent?.reservations.length} evenimente
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {selectedStudent?.reservations.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nicio înscriere.</p>
            ) : (
              selectedStudent?.reservations.map((r, i) => (
                <div key={i} className="flex items-center justify-between rounded-lg border px-3 py-2">
                  <div>
                    <p className="text-sm font-medium">{r.eventTitle}</p>
                    <p className="text-xs text-muted-foreground">{r.date} • {r.hours}h</p>
                  </div>
                  <Badge variant={
                    r.status === "present" ? "default" :
                    r.status === "late" ? "secondary" :
                    r.status === "absent" ? "destructive" : "outline"
                  }>
                    {statusLabels[r.status] || r.status}
                  </Badge>
                </div>
              ))
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
