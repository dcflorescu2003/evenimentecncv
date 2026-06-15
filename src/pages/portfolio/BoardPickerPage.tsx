import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { Dice5, Save, Trash2, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { BOARD_PICK_MODES, boardPickModeLabel } from "@/lib/portfolioInvolvement";

interface ClassRow {
  id: string;
  class_id: string;
  classes: { id: string; display_name: string; academic_year: string } | null;
}

interface StudentRow {
  id: string;
  first_name: string;
  last_name: string;
}

interface PickRow {
  id: string;
  student_id: string;
  picked_on: string;
  lesson: string | null;
  mode: string;
  score: number | null;
  note: string | null;
  attach_to_portfolio: boolean;
  student: { first_name: string; last_name: string } | null;
}

const TODAY = () => new Date().toISOString().slice(0, 10);

export default function BoardPickerPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const [classId, setClassId] = useState<string>("");
  const [mode, setMode] = useState<string>("random");
  const [lesson, setLesson] = useState<string>("");
  const [picked, setPicked] = useState<StudentRow | null>(null);
  const [excluded, setExcluded] = useState<Set<string>>(new Set());

  // Save dialog state
  const [saveOpen, setSaveOpen] = useState(false);
  const [score, setScore] = useState<string>("");
  const [note, setNote] = useState("");
  const [attach, setAttach] = useState(false);

  const { data: myClasses = [] } = useQuery({
    queryKey: ["portfolio_my_classes_picker", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_teacher_classes")
        .select("id, class_id, classes(id, display_name, academic_year)")
        .eq("teacher_id", user!.id);
      if (error) throw error;
      return (data ?? []) as unknown as ClassRow[];
    },
  });

  const { data: students = [] } = useQuery({
    queryKey: ["portfolio_picker_students", classId],
    enabled: !!classId,
    queryFn: async () => {
      const { data: a } = await supabase
        .from("student_class_assignments").select("student_id").eq("class_id", classId);
      const ids = (a ?? []).map((r) => r.student_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles").select("id, first_name, last_name").in("id", ids)
        .order("last_name").order("first_name");
      if (error) throw error;
      return (data ?? []) as StudentRow[];
    },
  });

  const { data: picks = [] } = useQuery({
    queryKey: ["portfolio_board_picks_history", user?.id, classId],
    enabled: !!user?.id && !!classId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_board_picks")
        .select("id, student_id, picked_on, lesson, mode, score, note, attach_to_portfolio")
        .eq("teacher_id", user!.id)
        .eq("class_id", classId)
        .order("created_at", { ascending: false })
        .limit(100);
      if (error) throw error;
      const list = (data ?? []) as any[];
      if (list.length === 0) return [];
      const ids = Array.from(new Set(list.map((p) => p.student_id)));
      const { data: profs } = await supabase
        .from("profiles").select("id, first_name, last_name").in("id", ids);
      const m = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return list.map((p) => ({ ...p, student: m.get(p.student_id) ?? null })) as PickRow[];
    },
  });

  const counts = useMemo(() => {
    const map = new Map<string, number>();
    picks.forEach((p) => map.set(p.student_id, (map.get(p.student_id) ?? 0) + 1));
    return map;
  }, [picks]);

  const pickedTodayIds = useMemo(() => {
    const today = TODAY();
    return new Set(picks.filter((p) => p.picked_on === today).map((p) => p.student_id));
  }, [picks]);

  const pickedThisWeekIds = useMemo(() => {
    const now = new Date();
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1; // monday=0
    const monday = new Date(now);
    monday.setDate(now.getDate() - day);
    const mondayISO = monday.toISOString().slice(0, 10);
    return new Set(picks.filter((p) => p.picked_on >= mondayISO).map((p) => p.student_id));
  }, [picks]);

  function performPick() {
    if (students.length === 0) {
      toast.error("Nu există elevi în această clasă");
      return;
    }
    let pool = students.filter((s) => !excluded.has(s.id));
    if (mode === "no_today") {
      pool = pool.filter((s) => !pickedTodayIds.has(s.id));
    } else if (mode === "no_repeat") {
      pool = pool.filter((s) => !pickedThisWeekIds.has(s.id));
    } else if (mode === "no_absent") {
      // for now, "no_absent" = same as full pool minus excluded (admin marks absents)
      pool = pool;
    }
    if (pool.length === 0) {
      toast.error("Niciun elev eligibil. Resetează filtrele sau alege alt mod.");
      return;
    }
    let chosen: StudentRow;
    if (mode === "balanced") {
      const min = Math.min(...pool.map((s) => counts.get(s.id) ?? 0));
      const leastPicked = pool.filter((s) => (counts.get(s.id) ?? 0) === min);
      chosen = leastPicked[Math.floor(Math.random() * leastPicked.length)];
    } else {
      chosen = pool[Math.floor(Math.random() * pool.length)];
    }
    setPicked(chosen);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!picked || !classId) throw new Error("Lipsesc date");
      const { error } = await supabase.from("portfolio_board_picks").insert({
        teacher_id: user!.id,
        class_id: classId,
        student_id: picked.id,
        picked_on: TODAY(),
        lesson: lesson.trim() || null,
        mode,
        score: score ? Number(score) : null,
        note: note.trim() || null,
        attach_to_portfolio: attach,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_board_picks_history"] });
      setSaveOpen(false);
      setScore(""); setNote(""); setAttach(false);
      toast.success("Salvat în istoric");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portfolio_board_picks").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_board_picks_history"] });
      toast.success("Șters");
    },
  });

  function toggleExclude(id: string) {
    setExcluded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Cine iese la tablă?</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Alege o clasă și un mod, apoi extrage un elev. Poți salva rezultatul în istoric.
        </p>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <div className="grid gap-3 sm:grid-cols-3">
            <div>
              <Label>Clasă</Label>
              <Select value={classId} onValueChange={(v) => { setClassId(v); setPicked(null); setExcluded(new Set()); }}>
                <SelectTrigger><SelectValue placeholder="Selectează…" /></SelectTrigger>
                <SelectContent>
                  {myClasses.map((c) => (
                    <SelectItem key={c.class_id} value={c.class_id}>
                      {c.classes?.display_name ?? "Clasă"}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Mod</Label>
              <Select value={mode} onValueChange={setMode}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {BOARD_PICK_MODES.map((m) => (
                    <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Lecție / temă (opțional)</Label>
              <Input value={lesson} onChange={(e) => setLesson(e.target.value)} placeholder="ex. Funcții de gradul I" />
            </div>
          </div>

          {mode === "no_absent" && classId && (
            <div className="space-y-1">
              <Label className="text-xs">Bifează absenții pentru a-i exclude:</Label>
              <div className="flex flex-wrap gap-2 max-h-40 overflow-y-auto rounded-md border p-2">
                {students.map((s) => (
                  <label key={s.id} className="flex items-center gap-1 text-xs">
                    <Checkbox
                      checked={excluded.has(s.id)}
                      onCheckedChange={() => toggleExclude(s.id)}
                    />
                    {s.last_name} {s.first_name}
                  </label>
                ))}
              </div>
            </div>
          )}

          {mode === "manual" && classId && (
            <div>
              <Label>Alege manual elevul</Label>
              <Select
                value={picked?.id ?? ""}
                onValueChange={(v) => setPicked(students.find((s) => s.id === v) ?? null)}
              >
                <SelectTrigger><SelectValue placeholder="Selectează…" /></SelectTrigger>
                <SelectContent>
                  {students.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.last_name} {s.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {mode !== "manual" && (
              <Button onClick={performPick} disabled={!classId}>
                <Dice5 className="h-4 w-4 mr-1" /> Extrage elev
              </Button>
            )}
            {picked && (
              <>
                <Button variant="outline" onClick={() => setPicked(null)}>
                  <RotateCcw className="h-4 w-4 mr-1" /> Reset
                </Button>
                <Button onClick={() => setSaveOpen(true)}>
                  <Save className="h-4 w-4 mr-1" /> Salvează în istoric
                </Button>
              </>
            )}
          </div>

          {picked && (
            <div className="rounded-lg border-2 border-primary/40 bg-primary/5 p-6 text-center">
              <div className="text-xs uppercase tracking-wide text-muted-foreground">La tablă iese</div>
              <div className="text-3xl font-display font-bold mt-1">
                {picked.last_name} {picked.first_name}
              </div>
              <div className="text-xs text-muted-foreground mt-2">
                Mod: {boardPickModeLabel(mode)} · scos de {counts.get(picked.id) ?? 0} ori
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {classId && picks.length > 0 && (
        <div className="space-y-2">
          <h2 className="font-semibold">Istoric</h2>
          {picks.slice(0, 20).map((p) => (
            <Card key={p.id}>
              <CardContent className="flex items-center justify-between p-3 text-sm">
                <div className="min-w-0">
                  <div className="font-medium truncate">
                    {p.student ? `${p.student.last_name} ${p.student.first_name}` : "Elev"}
                  </div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                    <span>{new Date(p.picked_on).toLocaleDateString("ro-RO")}</span>
                    <span>· {boardPickModeLabel(p.mode)}</span>
                    {p.lesson && <span>· {p.lesson}</span>}
                    {p.score != null && <span>· {p.score} pct</span>}
                  </div>
                  {p.note && <p className="text-xs mt-1 text-muted-foreground">{p.note}</p>}
                </div>
                <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(p.id)}>
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={saveOpen} onOpenChange={setSaveOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Salvează în istoric</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <p className="text-sm">
              Elev: <strong>{picked?.last_name} {picked?.first_name}</strong>
            </p>
            <div>
              <Label>Punctaj (opțional)</Label>
              <Input type="number" min={0} max={10} step={0.5}
                value={score} onChange={(e) => setScore(e.target.value)} />
            </div>
            <div>
              <Label>Observație</Label>
              <Textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={attach} onCheckedChange={(c) => setAttach(c === true)} />
              Atașează la portofoliul elevului
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSaveOpen(false)}>Anulează</Button>
            <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Se salvează…" : "Salvează"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
