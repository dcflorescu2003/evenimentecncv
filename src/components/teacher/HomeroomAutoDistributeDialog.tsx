import { DAILY_HOURS_CAP } from "@/lib/student-hours";
import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { enrollStudent } from "@/lib/manual-enrollment";
import { formatDate } from "@/lib/time";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import type { EnrollStudent } from "./HomeroomEnrollDialog";

type Ev = {
  id: string; title: string; date: string; start_time: string; end_time: string;
  location: string | null; counted_duration_hours: number | null; free_seats: number;
};
type Plan = { student: EnrollStudent; events: Ev[]; after: number };
type Result = { student: string; event: string; ok: boolean; reason?: string };

function shuffle<T>(a: T[]): T[] {
  const r = [...a];
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}
const overlaps = (a: Ev, b: Ev) => a.date === b.date && a.start_time < b.end_time && b.start_time < a.end_time;

function distribute(students: EnrollStudent[], cands: Record<string, Ev[]>): Plan[] {
  const seats: Record<string, number> = {};
  for (const list of Object.values(cands)) for (const e of list) seats[e.id] = e.free_seats;
  const plans: Plan[] = shuffle(students).map((s) => ({ student: s, events: [], after: s.reservedHours }));
  // round-robin: each pass gives at most one event per student, for fairness
  let progress = true;
  while (progress) {
    progress = false;
    for (const p of plans) {
      if (p.after >= p.student.requiredHours) continue;
      const dayH = (d: string) => p.events.filter((x) => x.date === d).reduce((s, x) => s + (x.counted_duration_hours ?? 0), 0);
      const ev = shuffle(cands[p.student.id] ?? []).find((e) =>
        (seats[e.id] ?? 0) > 0 && dayH(e.date) < DAILY_HOURS_CAP && !p.events.some((x) => x.id === e.id || overlaps(x, e)));
      if (!ev) continue;
      seats[ev.id]--;
      const gain = Math.min(ev.counted_duration_hours ?? 0, DAILY_HOURS_CAP - dayH(ev.date));
      p.events.push(ev);
      p.after += gain;
      progress = true;
    }
  }
  return plans.sort((a, b) => a.student.name.localeCompare(b.student.name, "ro"));
}

export default function HomeroomAutoDistributeDialog({ open, students, sessionId, onClose, onDone }: {
  open: boolean; students: EnrollStudent[]; sessionId: string; onClose: () => void; onDone: () => void;
}) {
  const { user } = useAuth();
  const [cands, setCands] = useState<Record<string, Ev[]> | null>(null);
  const [plans, setPlans] = useState<Plan[]>([]);
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<Result[] | null>(null);

  useEffect(() => {
    if (!open) { setCands(null); setPlans([]); setResults(null); return; }
    (async () => {
      const map: Record<string, Ev[]> = {};
      await Promise.all(students.map(async (s) => {
        const { data } = await supabase.rpc("list_enrollable_events_for_student" as any, { _student_id: s.id, _session_id: sessionId });
        map[s.id] = (data ?? []) as Ev[];
      }));
      setCands(map);
      setPlans(distribute(students, map));
    })();
  }, [open, students, sessionId]);

  const confirm = async () => {
    if (!user) return;
    setBusy(true);
    const out: Result[] = [];
    for (const p of plans) for (const ev of p.events) {
      const res = await enrollStudent(ev.id, p.student.id, { enrolledByUserId: user.id, enrolledByRole: "organizer" });
      out.push({ student: p.student.name, event: ev.title, ok: res.ok, reason: res.reason });
    }
    setBusy(false);
    setResults(out);
    onDone();
  };

  const total = plans.reduce((s, p) => s + p.events.length, 0);

  return (
    <Dialog open={open} onOpenChange={(o) => !o && !busy && onClose()}>
      <DialogContent className="max-w-3xl max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Distribuire automată</DialogTitle>
          <DialogDescription>
            {results ? "Rezultat" : `Propunere pentru ${students.length} elevi sub minim · ${total} înscrieri`}
          </DialogDescription>
        </DialogHeader>

        {results ? (
          <div className="space-y-2 text-sm">
            <p><strong>{results.filter((r) => r.ok).length}</strong> înscrieri reușite, <strong>{results.filter((r) => !r.ok).length}</strong> eșuate.</p>
            <ul className="space-y-1">
              {results.filter((r) => !r.ok).map((r, i) => (
                <li key={i} className="text-destructive">{r.student} — {r.event}: {r.reason ?? "eroare"}</li>
              ))}
            </ul>
          </div>
        ) : !cands ? (
          <p className="text-sm text-muted-foreground">Se caută evenimentele disponibile...</p>
        ) : (
          <ul className="space-y-3">
            {plans.map((p) => {
              const reached = p.after >= p.student.requiredHours;
              return (
                <li key={p.student.id} className="rounded-md border p-3 space-y-1">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-medium">{p.student.name}</span>
                    <div className="flex items-center gap-2 text-sm">
                      <span>{p.student.reservedHours} → <strong>{p.after}</strong> / {p.student.requiredHours} ore</span>
                      {!reached && <Badge variant="destructive">Minim neatins — nu mai sunt evenimente disponibile</Badge>}
                    </div>
                  </div>
                  {p.events.map((e) => (
                    <div key={e.id} className="text-xs text-muted-foreground">
                      • {e.title} — {formatDate(e.date)}, {e.start_time.slice(0, 5)}–{e.end_time.slice(0, 5)} · {e.counted_duration_hours ?? 0} ore
                    </div>
                  ))}
                </li>
              );
            })}
          </ul>
        )}

        <DialogFooter className="gap-2">
          {results ? (
            <Button onClick={onClose}>Închide</Button>
          ) : (
            <>
              <Button variant="outline" disabled={!cands || busy} onClick={() => cands && setPlans(distribute(students, cands))}>Refă distribuirea</Button>
              <Button disabled={!cands || busy || total === 0} onClick={confirm}>{busy ? "Se înscriu..." : "Confirmă"}</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
