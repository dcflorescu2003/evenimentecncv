import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { FileDown, FileText } from "lucide-react";
import { toast } from "sonner";
import { exportReportPdf } from "@/lib/report-pdf";
import { exportToCSV } from "@/lib/csv-export";
import { formatDate } from "@/lib/time";

type Kind = "club" | "volunteer";
interface Session { id: string; date: string; start_time?: string; end_time?: string }

const STATUS: Record<string, string> = { present: "P", late: "Î", absent: "A" };
const STATUS_LONG: Record<string, string> = { present: "Prezent", late: "Întârziat", absent: "Absent" };

async function fetchClasses(ids: string[]): Promise<Record<string, string>> {
  const map: Record<string, string> = {};
  for (let i = 0; i < ids.length; i += 150) {
    const chunk = ids.slice(i, i + 150);
    const { data } = await supabase
      .from("student_class_assignments")
      .select("student_id, classes(display_name, is_active)")
      .in("student_id", chunk)
      .range(0, 999);
    (data ?? []).forEach((r: any) => {
      if (r.classes && (r.classes.is_active !== false || !map[r.student_id])) map[r.student_id] = r.classes.display_name;
    });
  }
  return map;
}

async function fetchAttendance(kind: Kind, sessionIds: string[]) {
  const table = kind === "club" ? "club_attendance" : "volunteer_attendance";
  const col = kind === "club" ? "meeting_id" : "day_id";
  const out: any[] = [];
  for (let i = 0; i < sessionIds.length; i += 100) {
    const chunk = sessionIds.slice(i, i + 100);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await (supabase.from(table as any) as any)
        .select(`${col}, student_id, status`).in(col, chunk).range(from, from + 999);
      if (error) throw error;
      out.push(...(data ?? []).map((r: any) => ({ session_id: r[col], student_id: r.student_id, status: r.status })));
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

const name = (e: any) => `${e.profile?.last_name ?? ""} ${e.profile?.first_name ?? ""}`.trim();
const safe = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, "-").slice(0, 60);

export default function ParticipantsExportBar({
  kind, title, enrollments, sessions,
}: { kind: Kind; title: string; enrollments: any[]; sessions?: Session[] }) {
  const [busy, setBusy] = useState(false);
  const [sessionId, setSessionId] = useState("_all");

  async function run(fmt: "pdf" | "csv") {
    if (!enrollments.length) { toast.error("Nu există participanți"); return; }
    setBusy(true);
    try {
      const classes = await fetchClasses(enrollments.map((e) => e.student_id));
      const sorted = [...enrollments].sort((a, b) => name(a).localeCompare(name(b), "ro"));
      let headers: string[]; let rows: string[][]; let subtitle: string; let file: string;
      let orientation: "portrait" | "landscape" = "portrait";

      if (!sessions) {
        headers = ["Nr.", "Nume Prenume", "Clasă", "Data înscrierii"];
        rows = sorted.map((e, i) => [String(i + 1), name(e), classes[e.student_id] ?? "—", formatDate(e.enrolled_at)]);
        subtitle = "Lista participanților";
        file = `participanti-${safe(title)}`;
      } else {
        const list = [...sessions].sort((a, b) => (a.date + (a.start_time ?? "")).localeCompare(b.date + (b.start_time ?? "")));
        const chosen = sessionId === "_all" ? list : list.filter((s) => s.id === sessionId);
        if (!chosen.length) { toast.error("Nu există întâlniri"); return; }
        const att = await fetchAttendance(kind, chosen.map((s) => s.id));
        const key = (s: string, st: string) => `${s}|${st}`;
        const m = new Map(att.map((a) => [key(a.session_id, a.student_id), a.status]));
        if (sessionId === "_all") {
          headers = ["Nr.", "Nume Prenume", "Clasă", ...chosen.map((s) => formatDate(s.date).slice(0, 5)), "Prezențe", "Absențe"];
          rows = sorted.map((e, i) => {
            let p = 0, a = 0;
            const cells = chosen.map((s) => {
              const st = m.get(key(s.id, e.student_id));
              if (st === "present" || st === "late") p++; else if (st === "absent") a++;
              return st ? STATUS[st] ?? st : "—";
            });
            return [String(i + 1), name(e), classes[e.student_id] ?? "—", ...cells, String(p), String(a)];
          });
          subtitle = "Lista de prezență (P = prezent, Î = întârziat, A = absent)";
          file = `prezenta-${safe(title)}`;
          if (chosen.length > 4) orientation = "landscape";
        } else {
          const s = chosen[0];
          headers = ["Nr.", "Nume Prenume", "Clasă", "Status", ...(fmt === "pdf" ? ["Semnătură"] : [])];
          rows = sorted.map((e, i) => {
            const st = m.get(key(s.id, e.student_id));
            return [String(i + 1), name(e), classes[e.student_id] ?? "—", st ? STATUS_LONG[st] ?? st : "—", ...(fmt === "pdf" ? [""] : [])];
          });
          subtitle = `Lista de prezență · ${formatDate(s.date)}${s.start_time ? ` · ${s.start_time.slice(0, 5)}–${s.end_time?.slice(0, 5) ?? ""}` : ""}`;
          file = `prezenta-${safe(title)}-${s.date}`;
        }
      }

      if (fmt === "pdf") await exportReportPdf({ title, subtitle, headers, rows, filename: file, orientation });
      else await exportToCSV(file, headers, rows);
      toast.success("Export generat");
    } catch (e: any) {
      toast.error(e.message ?? "Eroare la export");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {sessions && (
        <Select value={sessionId} onValueChange={setSessionId}>
          <SelectTrigger className="w-full sm:w-56"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Toate întâlnirile</SelectItem>
            {[...sessions].sort((a, b) => b.date.localeCompare(a.date)).map((s) => (
              <SelectItem key={s.id} value={s.id}>
                {formatDate(s.date)}{s.start_time ? ` · ${s.start_time.slice(0, 5)}` : ""}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("pdf")}>
        <FileText className="mr-2 h-4 w-4" />{sessions ? "Prezență PDF" : "Participanți PDF"}
      </Button>
      <Button size="sm" variant="outline" disabled={busy} onClick={() => run("csv")}>
        <FileDown className="mr-2 h-4 w-4" />{sessions ? "Prezență CSV" : "Participanți CSV"}
      </Button>
    </div>
  );
}
