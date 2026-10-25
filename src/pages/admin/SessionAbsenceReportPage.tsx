import { useEffect, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { fetchInChunks } from "@/lib/supabase-chunk";
import { computeDailyAbsences, weekdaysBetween, DAILY_HOURS_CAP } from "@/lib/student-hours";
import { exportReportPdfSections } from "@/lib/report-pdf";
import { exportToCSV } from "@/lib/csv-export";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { FileDown, FileText } from "lucide-react";

const ALL = "_all";
const fmt = (d: string) => `${d.slice(8, 10)}.${d.slice(5, 7)}.${d.slice(0, 4)}`;
const WD = ["Du", "Lu", "Ma", "Mi", "Jo", "Vi", "Sâ"];
const wd = (d: string) => WD[new Date(d + "T12:00:00Z").getUTCDay()];
const todayStr = () => new Date().toLocaleDateString("sv-SE", { timeZone: "Europe/Bucharest" });

export default function SessionAbsenceReportPage() {
  const [sessionId, setSessionId] = useState("");
  const [classId, setClassId] = useState(ALL);

  const { data: sessions = [] } = useQuery({
    queryKey: ["sar-sessions"],
    queryFn: async () => {
      const { data } = await supabase.from("program_sessions").select("id, name, start_date, end_date, status").order("start_date", { ascending: false });
      return data || [];
    },
  });
  useEffect(() => {
    if (!sessionId && sessions.length) setSessionId((sessions.find((s: any) => s.status === "active") || sessions[0]).id);
  }, [sessions, sessionId]);
  const session: any = sessions.find((s: any) => s.id === sessionId);

  const { data: classes = [] } = useQuery({
    queryKey: ["sar-classes"],
    queryFn: async () => {
      const { data } = await supabase.from("classes").select("id, display_name, grade_number, section").eq("is_active", true).order("grade_number").order("section", { nullsFirst: true });
      return data || [];
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ["sar-data", sessionId, classId, classes.length],
    staleTime: 0,
    refetchOnMount: "always",
    enabled: !!session && classes.length > 0,
    queryFn: async () => {
      const classIds = classId === ALL ? classes.map((c) => c.id) : [classId];
      const rawAssignments = await fetchInChunks<{ id: string; student_id: string; class_id: string }>(classIds, 100, (ch, f, t) =>
        supabase.from("student_class_assignments").select("id, student_id, class_id").in("class_id", ch).order("id").range(f, t));
      const seenA = new Set<string>();
      const assignments = rawAssignments.filter((a) => { const k = `${a.student_id}|${a.class_id}`; if (seenA.has(k)) return false; seenA.add(k); return true; });
      const studentIds = [...new Set(assignments.map((a) => a.student_id))];
      const profiles = await fetchInChunks<{ id: string; first_name: string; last_name: string }>(studentIds, 200, (ch, f, t) =>
        supabase.from("profiles").select("id, first_name, last_name").in("id", ch).order("id").range(f, t));
      const { data: events } = await supabase.from("events").select("id, date, counted_duration_hours").eq("session_id", sessionId).not("status", "in", "(draft,cancelled)");
      const evMap = new Map((events || []).map((e) => [e.id, e]));
      const reservations = await fetchInChunks<{ id: string; student_id: string; event_id: string }>([...evMap.keys()], 150, (ch, f, t) =>
        supabase.from("reservations").select("id, student_id, event_id").eq("status", "reserved").in("event_id", ch).order("id").range(f, t));
      const resMap = new Map(reservations.map((r) => [r.id, r]));
      const tickets = await fetchInChunks<{ id: string; reservation_id: string }>([...resMap.keys()], 150, (ch, f, t) =>
        supabase.from("tickets").select("id, reservation_id").in("status", ["present", "late"]).in("reservation_id", ch).order("id").range(f, t));
      const assistants = await fetchInChunks<{ id: string; student_id: string; event_id: string }>([...evMap.keys()], 150, (ch, f, t) =>
        supabase.from("event_student_assistants").select("id, student_id, event_id").in("event_id", ch).order("id").range(f, t));
      const done = new Set<string>();
      const pairs: { student_id: string; event_id: string }[] = [
        ...tickets.map((t) => resMap.get(t.reservation_id)).filter(Boolean) as any[],
        ...assistants,
      ];
      const hours = new Map<string, Map<string, number>>();
      for (const r of pairs) {
        const k = `${r.event_id}|${r.student_id}`; if (done.has(k)) continue; done.add(k);
        const e = evMap.get(r.event_id); if (!e) continue;
        if (!hours.has(r.student_id)) hours.set(r.student_id, new Map());
        const m = hours.get(r.student_id)!;
        m.set(e.date, (m.get(e.date) ?? 0) + Number(e.counted_duration_hours ?? 0));
      }
      const { data: rules } = await supabase.from("class_participation_rules").select("class_id, required_value").eq("session_id", sessionId).eq("requirement_type", "hours");
      const norms = new Map((rules || []).map((r: any) => [r.class_id, Number(r.required_value)]));
      return { assignments, profiles, hours, norms };
    },
  });

  const days = useMemo(() => (session ? weekdaysBetween(session.start_date, session.end_date) : []), [session]);
  // Closed session: every day counts as finished (use a cutoff after the end date).
  const today = session?.status === "closed" ? "9999-12-31" : todayStr();

  const groups = useMemo(() => {
    if (!data) return [];
    const pMap = new Map(data.profiles.map((p) => [p.id, p]));
    return classes
      .filter((c) => classId === ALL || c.id === classId)
      .map((c) => {
        const students = data.assignments.filter((a) => a.class_id === c.id).map((a) => pMap.get(a.student_id)).filter(Boolean) as any[];
        students.sort((a, b) => (a.last_name ?? "").localeCompare(b.last_name ?? "", "ro") || (a.first_name ?? "").localeCompare(b.first_name ?? "", "ro"));
        return {
          name: c.display_name,
          rows: students.map((s) => ({ name: `${s.last_name} ${s.first_name}`, ...computeDailyAbsences(days, data.hours.get(s.id) ?? new Map(), today, data.norms.get(c.id)) })),
        };
      })
      .filter((g) => g.rows.length);
  }, [data, classes, classId, days, today]);

  const absentFor = (r: (typeof groups)[number]["rows"][number], d: string) => r.absentByDay[d];
  const headers = ["Nr.", "Nume Prenume", ...days.map((d) => `${wd(d)} ${fmt(d).slice(0, 5)}`), "Total"];
  const toRows = (g: (typeof groups)[number]) => g.rows.map((r, i) => [String(i + 1), r.name, ...days.map((d) => (d < today ? String(absentFor(r, d)) : "—")), String(r.absences)]);

  const title = `Raport sesiune — ${session?.name ?? ""}`;
  const pdf = () => exportReportPdfSections({ title, orientation: "landscape", filename: "raport-sesiune-absente", newPagePerSection: true, sections: groups.map((g) => ({ title: g.name, headers, rows: toRows(g) })) });
  const csv = () => exportToCSV("raport-sesiune-absente", ["Clasă", ...headers], groups.flatMap((g) => toRows(g).map((r) => [g.name, ...r])));

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold">Raport sesiune</h1>
          <p className="text-sm text-muted-foreground">Ore absentate pe zi (din maxim {DAILY_HOURS_CAP}h/zi); „Total” = suma orelor nerealizate, doar pentru zilele încheiate.</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" disabled={!groups.length} onClick={pdf}><FileText className="mr-2 h-4 w-4" />PDF</Button>
          <Button variant="outline" disabled={!groups.length} onClick={csv}><FileDown className="mr-2 h-4 w-4" />CSV</Button>
        </div>
      </div>
      <div className="flex flex-col gap-2 sm:flex-row">
        <Select value={sessionId} onValueChange={setSessionId}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue placeholder="Sesiune" /></SelectTrigger>
          <SelectContent>{sessions.map((s: any) => <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>)}</SelectContent>
        </Select>
        <Select value={classId} onValueChange={setClassId}>
          <SelectTrigger className="w-full sm:w-48"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value={ALL}>Toate clasele</SelectItem>
            {classes.map((c) => <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>
      {isLoading && <p className="text-muted-foreground">Se încarcă...</p>}
      {!isLoading && data && !groups.length && <p className="text-muted-foreground">Nu există elevi pentru selecția făcută.</p>}
      {groups.map((g) => (
        <div key={g.name} className="space-y-2">
          <h3 className="font-semibold text-lg">{g.name}</h3>
          <div className="overflow-x-auto rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>{headers.map((h) => <TableHead key={h} className="whitespace-nowrap">{h}</TableHead>)}</TableRow>
              </TableHeader>
              <TableBody>
                {g.rows.map((r, i) => (
                  <TableRow key={i}>
                    <TableCell>{i + 1}</TableCell>
                    <TableCell className="whitespace-nowrap">{r.name}</TableCell>
                    {days.map((d) => {
                      const a = absentFor(r, d);
                      return (
                        <TableCell key={d} className={d >= today ? "text-muted-foreground" : a > 0 ? "text-destructive font-semibold" : "text-success font-semibold"}>
                          {d < today ? a : "—"}
                        </TableCell>
                      );
                    })}
                    <TableCell className={r.absences > 0 ? "text-destructive font-bold" : "text-success font-bold"}>{r.absences}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>
      ))}
    </div>
  );
}
