import { useState } from "react";
import { Link } from "react-router-dom";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, Download, FileCode2, Upload } from "lucide-react";
import { toast } from "sonner";
import { buildTimetable, type ImportResult, type TeacherProfile } from "@/lib/timetable-import";

type Kind = "students" | "teachers" | "staffroom" | "rooms";
const SLOTS: { kind: Kind; label: string; hint: string; model: string; required?: boolean }[] = [
  { kind: "students", label: "Orar elevi", hint: "Câte un tabel per clasă („Clasa IX A”); celule „materie sală inițiale”, grupe separate prin „ / ”.", model: "/models/model-orar-elevi.xml", required: true },
  { kind: "teachers", label: "Orar profesori", hint: "Câte un tabel per profesor („Profesor NUME PRENUME”); celule „materie sală clasă”.", model: "/models/model-orar-profesori.xml" },
  { kind: "staffroom", label: "Orar cancelarie", hint: "Câte un tabel per zi („Cancelarie - Luni”); rândurile sunt profesorii.", model: "/models/model-orar-cancelarie.xml" },
  { kind: "rooms", label: "Orar săli", hint: "Câte un tabel per sală („Sala 5”); celule „materie clasă inițiale”. Folosit pentru verificare.", model: "/models/model-orar-sali.xml" },
];

export default function TimetableImportPage() {
  const qc = useQueryClient();
  const [files, setFiles] = useState<Partial<Record<Kind, { name: string; text: string }>>>({});
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [year, setYear] = useState<string>("");

  const pick = async (kind: Kind, f?: File) => {
    if (!f) return;
    const text = await f.text();
    setFiles((p) => ({ ...p, [kind]: { name: f.name, text } }));
    setResult(null);
  };

  const analyze = async () => {
    if (!files.students) return toast.error("Încarcă orarul elevilor.");
    setBusy(true);
    try {
      const { data: roleRows, error: re } = await supabase.from("user_roles").select("user_id").in("role", ["teacher", "homeroom_teacher"]);
      if (re) throw re;
      const ids = [...new Set((roleRows ?? []).map((r) => r.user_id))];
      const profiles: TeacherProfile[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error } = await supabase.from("profiles").select("id, first_name, last_name, initials").in("id", ids.slice(i, i + 200));
        if (error) throw error;
        profiles.push(...((data ?? []) as TeacherProfile[]));
      }
      const { data: rooms, error: rr } = await supabase.from("vr_rooms").select("name");
      if (rr) throw rr;
      const { data: cls } = await supabase.from("classes").select("academic_year").eq("is_active", true).limit(1);
      setYear(cls?.[0]?.academic_year ?? "");
      setResult(buildTimetable({
        studentsXml: files.students.text, teachersXml: files.teachers?.text, staffroomXml: files.staffroom?.text,
        roomsXml: files.rooms?.text, profiles, roomNames: (rooms ?? []).map((r) => r.name),
      }));
    } catch (e) {
      toast.error(`Analiza a eșuat: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  const apply = async () => {
    if (!result) return;
    setBusy(true);
    try {
      const { data: classes, error } = await supabase.from("classes").select("id, grade_number, section, academic_year").eq("is_active", true);
      if (error) throw error;
      const byCode = new Map((classes ?? []).map((c) => [`${c.grade_number}${c.section ?? "A"}`, c]));
      let ok = 0; let rows = 0; const missing: string[] = [];
      for (const c of result.classes) {
        const cl = byCode.get(c.code);
        if (!cl) { missing.push(c.label); continue; }
        let { data: sch } = await supabase.from("class_schedules").select("id").eq("class_id", cl.id).eq("academic_year", cl.academic_year).maybeSingle();
        if (!sch) {
          const ins = await supabase.from("class_schedules").insert({ class_id: cl.id, academic_year: cl.academic_year }).select("id").single();
          if (ins.error) throw ins.error;
          sch = ins.data;
        }
        const del = await supabase.from("schedule_entries").delete().eq("schedule_id", sch.id);
        if (del.error) throw del.error;
        if (c.entries.length) {
          const ins = await supabase.from("schedule_entries").insert(c.entries.map((e) => ({ ...e, schedule_id: sch!.id })));
          if (ins.error) throw ins.error;
        }
        ok++; rows += c.entries.length;
      }
      for (const u of result.initialsUpdates) await supabase.from("profiles").update({ initials: u.initials }).eq("id", u.id);
      await qc.invalidateQueries({ queryKey: ["school_timetable"] });
      toast.success(`Orar regenerat: ${ok} clase, ${rows} ore${missing.length ? `. Clase inexistente: ${missing.join(", ")}` : ""}`);
      setResult(null);
    } catch (e) {
      toast.error(`Importul a eșuat: ${(e as Error).message}`);
    } finally { setBusy(false); }
  };

  const total = result?.classes.reduce((s, c) => s + c.entries.length, 0) ?? 0;

  return (
    <div className="mx-auto max-w-4xl space-y-4">
      <Button asChild variant="ghost" size="sm"><Link to="/admin/schedules"><ArrowLeft className="mr-1 h-4 w-4" />Orare clase</Link></Button>
      <div>
        <h1 className="font-display text-2xl font-semibold">Import orare</h1>
        <p className="text-sm text-muted-foreground">Încarcă fișierele XML; orarul tuturor claselor se regenerează. Sălile se potrivesc cu cele definite în „Săli”, iar profesorii cu conturile lor.</p>
      </div>
      <div className="grid gap-3 sm:grid-cols-2">
        {SLOTS.map((s) => (
          <Card key={s.kind}>
            <CardHeader className="pb-2">
              <CardTitle className="flex items-center gap-2 text-base"><FileCode2 className="h-4 w-4 text-primary" />{s.label}{s.required && <Badge variant="secondary">obligatoriu</Badge>}</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <p className="text-xs text-muted-foreground">{s.hint}</p>
              <div className="flex flex-wrap gap-2">
                <Button asChild size="sm" variant="outline"><label className="cursor-pointer"><Upload className="mr-1 h-4 w-4" />Alege fișier
                  <input type="file" accept=".xml,text/xml" className="hidden" aria-label={s.label} onChange={(e) => pick(s.kind, e.target.files?.[0])} /></label></Button>
                <Button asChild size="sm" variant="ghost"><a href={s.model} download><Download className="mr-1 h-4 w-4" />Descarcă model</a></Button>
              </div>
              {files[s.kind] && <p className="truncate text-xs">{files[s.kind]!.name}</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      <Button onClick={analyze} disabled={busy || !files.students}>Analizează</Button>

      {result && (
        <Card>
          <CardHeader><CardTitle className="text-lg">Previzualizare{year && ` – ${year}`}</CardTitle></CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p>{result.classes.length} clase, {total} ore.</p>
            {result.unknownRooms.length > 0 && <p className="text-destructive">Săli negăsite în listă (adaugă-le din „Săli” și reanalizează, altfel rămân cu codul din fișier): {result.unknownRooms.join(", ")}</p>}
            {result.unmatchedTeachers.length > 0 && <p className="text-destructive">Profesori fără cont: {result.unmatchedTeachers.join(", ")}</p>}
            {result.unresolvedInitials.length > 0 && <p>Inițiale neidentificate: {result.unresolvedInitials.join(", ")}</p>}
            {result.initialsUpdates.length > 0 && <p>Se actualizează inițialele pentru {result.initialsUpdates.length} profesori.</p>}
            {result.roomConflicts.length > 0 && (
              <details><summary className="cursor-pointer">{result.roomConflicts.length} diferențe față de orarul sălilor</summary>
                <ul className="mt-1 list-disc pl-5 text-xs text-muted-foreground">{result.roomConflicts.map((c) => <li key={c}>{c}</li>)}</ul></details>
            )}
            {result.warnings.map((w) => <p key={w}>{w}</p>)}
            <Button onClick={apply} disabled={busy}>Confirmă și regenerează orarele</Button>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
