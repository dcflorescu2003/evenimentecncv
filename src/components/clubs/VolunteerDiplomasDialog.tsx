import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Award, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { dayHours, exportVolunteerDiplomas } from "@/lib/volunteer-diploma";

interface Day { id: string; start_time?: string | null; end_time?: string | null }
interface Row { id: string; name: string; hours: number; checked: boolean }

async function fetchPresent(dayIds: string[]) {
  const out: { day_id: string; student_id: string }[] = [];
  for (let i = 0; i < dayIds.length; i += 100) {
    const chunk = dayIds.slice(i, i + 100);
    for (let from = 0; ; from += 1000) {
      const { data, error } = await supabase.from("volunteer_attendance")
        .select("day_id, student_id, status").in("day_id", chunk).in("status", ["present", "late"])
        .order("id").range(from, from + 999);
      if (error) throw error;
      out.push(...(data ?? []) as any);
      if (!data || data.length < 1000) break;
    }
  }
  return out;
}

export default function VolunteerDiplomasDialog({ projectName, enrollments, days }: {
  projectName: string; enrollments: any[]; days: Day[];
}) {
  const [open, setOpen] = useState(false);
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [busy, setBusy] = useState(false);
  const [regNumber, setRegNumber] = useState("");

  useEffect(() => {
    if (!open) return;
    let cancel = false;
    (async () => {
      setLoading(true);
      try {
        const hoursByDay = new Map(days.map((d) => [d.id, dayHours(d.start_time, d.end_time)]));
        const att = days.length ? await fetchPresent(days.map((d) => d.id)) : [];
        const total = new Map<string, number>();
        const seen = new Set<string>();
        for (const a of att) {
          const k = `${a.student_id}|${a.day_id}`;
          if (seen.has(k)) continue;
          seen.add(k);
          total.set(a.student_id, (total.get(a.student_id) ?? 0) + (hoursByDay.get(a.day_id) ?? 0));
        }
        const list = enrollments
          .filter((e) => !e.status || e.status === "enrolled")
          .map((e) => {
            const h = total.get(e.student_id) ?? 0;
            return {
              id: e.student_id,
              name: `${e.profile?.last_name ?? ""} ${e.profile?.first_name ?? ""}`.trim(),
              hours: h, checked: h > 0,
            };
          })
          .sort((a, b) => a.name.localeCompare(b.name, "ro"));
        if (!cancel) setRows(list);
      } catch {
        toast.error("Nu s-au putut încărca prezențele");
      } finally { if (!cancel) setLoading(false); }
    })();
    return () => { cancel = true; };
  }, [open, enrollments, days]);

  const selected = useMemo(() => rows.filter((r) => r.checked), [rows]);

  async function generate() {
    if (!selected.length) { toast.error("Selectează cel puțin un participant"); return; }
    setBusy(true);
    try { await exportVolunteerDiplomas(projectName, selected.map((r) => ({ name: r.name, hours: r.hours }))); }
    catch { toast.error("Nu s-au putut genera diplomele"); }
    finally { setBusy(false); }
  }

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Award className="mr-2 h-4 w-4" /> Diplome
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Diplome de voluntariat</DialogTitle>
            <DialogDescription>Bifează participanții și verifică orele înainte de printare.</DialogDescription>
          </DialogHeader>
          <div className="flex gap-2">
            <Button size="sm" variant="ghost" onClick={() => setRows((r) => r.map((x) => ({ ...x, checked: true })))}>Selectează toți</Button>
            <Button size="sm" variant="ghost" onClick={() => setRows((r) => r.map((x) => ({ ...x, checked: x.hours > 0 })))}>Doar cei cu ore</Button>
          </div>
          {loading ? (
            <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : rows.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Nu există participanți înscriși.</p>
          ) : (
            <div className="max-h-96 space-y-1 overflow-y-auto rounded-md border p-2">
              {rows.map((r) => (
                <div key={r.id} className="flex items-center gap-2 py-1">
                  <Checkbox checked={r.checked} onCheckedChange={(v) => setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, checked: !!v } : x))} />
                  <span className="flex-1 truncate text-sm">{r.name}</span>
                  <Input type="number" min={0} className="h-8 w-20" value={r.hours}
                    onChange={(e) => { const h = Math.max(0, parseInt(e.target.value) || 0); setRows((rs) => rs.map((x) => x.id === r.id ? { ...x, hours: h } : x)); }} />
                  <span className="text-xs text-muted-foreground">ore</span>
                </div>
              ))}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Închide</Button>
            <Button onClick={generate} disabled={busy || loading}>
              {busy && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Descarcă diplomele (PDF) · {selected.length}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
