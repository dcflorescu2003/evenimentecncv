import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { ArrowLeft, Upload } from "lucide-react";
import { toast } from "sonner";
import ScheduleGridEditor, { type EditorEntry } from "@/components/schedule/ScheduleGridEditor";
import { DAYS } from "@/lib/schedule-periods";

interface ClassRow {
  id: string;
  display_name: string;
  academic_year: string;
  has_schedule: boolean;
}

const dayNameToNum = (s: string): number | null => {
  const norm = s.trim().toLowerCase();
  const map: Record<string, number> = {
    "1": 1, "2": 2, "3": 3, "4": 4, "5": 5,
    luni: 1, marti: 2, "marți": 2, miercuri: 3, joi: 4, vineri: 5,
  };
  return map[norm] ?? null;
};

export default function SchedulesPage() {
  const [classes, setClasses] = useState<ClassRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<ClassRow | null>(null);
  const [entries, setEntries] = useState<EditorEntry[]>([]);
  const [scheduleId, setScheduleId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const loadClasses = async () => {
    setLoading(true);
    const { data: classRows } = await supabase
      .from("classes")
      .select("id, display_name, academic_year")
      .eq("is_active", true)
      .order("display_name");
    const { data: schedules } = await supabase
      .from("class_schedules")
      .select("class_id, academic_year");
    const set = new Set((schedules ?? []).map((s) => `${s.class_id}|${s.academic_year}`));
    setClasses(
      (classRows ?? []).map((c) => ({
        ...c,
        has_schedule: set.has(`${c.id}|${c.academic_year}`),
      })),
    );
    setLoading(false);
  };

  useEffect(() => {
    loadClasses();
  }, []);

  const openClass = async (c: ClassRow) => {
    setSelected(c);
    setEntries([]);
    setScheduleId(null);
    const { data: schedule } = await supabase
      .from("class_schedules")
      .select("id")
      .eq("class_id", c.id)
      .eq("academic_year", c.academic_year)
      .maybeSingle();
    if (schedule) {
      setScheduleId(schedule.id);
      const { data: rows } = await supabase
        .from("schedule_entries")
        .select("day_of_week, period, subject, teacher_name, room")
        .eq("schedule_id", schedule.id);
      setEntries(
        (rows ?? []).map((r) => ({
          day_of_week: r.day_of_week,
          period: r.period,
          subject: r.subject ?? "",
          teacher_name: r.teacher_name ?? "",
          room: r.room ?? "",
        })),
      );
    }
  };

  const persist = async (rows: EditorEntry[]) => {
    if (!selected) return;
    setSaving(true);
    try {
      let sid = scheduleId;
      if (!sid) {
        const { data: created, error } = await supabase
          .from("class_schedules")
          .insert({ class_id: selected.id, academic_year: selected.academic_year })
          .select("id")
          .single();
        if (error) throw error;
        sid = created.id;
        setScheduleId(sid);
      } else {
        await supabase.from("schedule_entries").delete().eq("schedule_id", sid);
      }

      if (rows.length > 0) {
        const payload = rows.map((r) => ({
          schedule_id: sid,
          day_of_week: r.day_of_week,
          period: r.period,
          subject: r.subject.trim(),
          teacher_name: r.teacher_name.trim() || null,
          room: r.room.trim() || null,
        }));
        const { error: insErr } = await supabase.from("schedule_entries").insert(payload);
        if (insErr) throw insErr;
      }
      toast.success("Orar salvat");
      await loadClasses();
    } catch (e: any) {
      toast.error("Eroare la salvare: " + (e?.message ?? "necunoscută"));
    } finally {
      setSaving(false);
    }
  };

  const handleCsvUpload = async (file: File) => {
    const text = await file.text();
    const lines = text.split(/\r?\n/).filter((l) => l.trim());
    if (lines.length < 2) {
      toast.error("CSV gol sau invalid");
      return;
    }
    const header = lines[0].split(",").map((h) => h.trim().toLowerCase());
    const idx = {
      day: header.indexOf("day"),
      period: header.indexOf("period"),
      subject: header.indexOf("subject"),
      teacher: header.indexOf("teacher_name"),
      room: header.indexOf("room"),
    };
    if (idx.day < 0 || idx.period < 0 || idx.subject < 0) {
      toast.error("Header CSV incorect (necesar: day, period, subject)");
      return;
    }
    const rows: EditorEntry[] = [];
    for (let i = 1; i < lines.length; i++) {
      const cols = lines[i].split(",").map((c) => c.trim());
      const day = dayNameToNum(cols[idx.day] ?? "");
      const period = parseInt(cols[idx.period] ?? "", 10);
      const subject = cols[idx.subject] ?? "";
      if (!day || !period || !subject) continue;
      rows.push({
        day_of_week: day,
        period,
        subject,
        teacher_name: idx.teacher >= 0 ? cols[idx.teacher] ?? "" : "",
        room: idx.room >= 0 ? cols[idx.room] ?? "" : "",
      });
    }
    if (rows.length === 0) {
      toast.error("Niciun rând valid în CSV");
      return;
    }
    setEntries(rows);
    toast.success(`${rows.length} rânduri încărcate. Verifică și apasă „Salvează".`);
  };

  if (selected) {
    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="sm" onClick={() => setSelected(null)}>
            <ArrowLeft className="mr-1 h-4 w-4" /> Înapoi
          </Button>
          <div>
            <h1 className="font-display text-xl font-semibold">{selected.display_name}</h1>
            <p className="text-xs text-muted-foreground">An academic: {selected.academic_year}</p>
          </div>
        </div>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between gap-2 space-y-0">
            <CardTitle className="text-base">Editor orar</CardTitle>
            <div className="flex items-center gap-2">
              <input
                id="csv-upload"
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) handleCsvUpload(f);
                  e.target.value = "";
                }}
              />
              <Button
                variant="outline"
                size="sm"
                onClick={() => document.getElementById("csv-upload")?.click()}
              >
                <Upload className="mr-1 h-4 w-4" /> Import CSV
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-xs text-muted-foreground">
              Format CSV: <code>day,period,subject,teacher_name,room</code> — <code>day</code> = 1-5 sau Luni/Marți/.../Vineri. Importul înlocuiește toate orele afișate până la următoarea salvare.
            </p>
            <ScheduleGridEditor
              key={selected.id + (scheduleId ?? "")}
              initial={entries}
              onSave={persist}
              saving={saving}
            />
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Orare clase</h1>
        <p className="text-sm text-muted-foreground">
          Selectează o clasă pentru a edita orarul ei. Zilele sunt L-V, până la 12 ore pe zi.
        </p>
      </div>

      {loading ? (
        <Skeleton className="h-32 w-full" />
      ) : (
        <Card>
          <CardContent className="p-0">
            <table className="w-full text-sm">
              <thead className="bg-muted/40">
                <tr>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">Clasă</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">An academic</th>
                  <th className="p-3 text-left text-xs font-medium text-muted-foreground">Stare</th>
                  <th className="p-3" />
                </tr>
              </thead>
              <tbody>
                {classes.map((c) => (
                  <tr key={c.id} className="border-t">
                    <td className="p-3 font-medium">{c.display_name}</td>
                    <td className="p-3 text-muted-foreground">{c.academic_year}</td>
                    <td className="p-3">
                      {c.has_schedule ? (
                        <Badge variant="default">Are orar</Badge>
                      ) : (
                        <Badge variant="outline">Fără orar</Badge>
                      )}
                    </td>
                    <td className="p-3 text-right">
                      <Button size="sm" variant="outline" onClick={() => openClass(c)}>
                        {c.has_schedule ? "Editează" : "Creează"}
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
