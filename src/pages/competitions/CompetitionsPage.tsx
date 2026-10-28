import { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Trophy, Plus, Trash2, Pencil, LogOut, X, Loader2, FileDown } from "lucide-react";
import { ModuleSwitcher } from "@/components/ModuleSwitcher";
import { searchProfiles, matchesSearch, type ProfileSearchResult } from "@/lib/search";
import {
  DEPARTMENTS, CATEGORIES, STAGES, PRIZES, buildAwardRows, countBy, currentAcademicYear,
  type Department, type Category, type Stage, type Prize,
} from "@/lib/competitions";
import { exportReportPdfSections } from "@/lib/report-pdf";
import { exportToCSV } from "@/lib/csv-export";

interface Competition { id: string; name: string; department: Department; category: Category | null; is_active: boolean }
interface Award {
  id: string; competition_id: string; student_id: string; teacher_id: string;
  stage: Stage; prize: Prize; academic_year: string; created_at: string;
}
interface Person { id: string; first_name: string; last_name: string }

const TEACHER_ROLES = ["teacher", "homeroom_teacher"];
const REPORT_ROLES = ["admin", "manager", "cse"];
const fullName = (p?: Person) => (p ? `${p.last_name} ${p.first_name}` : "—");

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>) {
  const out: T[] = [];
  for (let from = 0; ; from += 1000) {
    const { data, error } = await build(from, from + 999);
    if (error) throw error;
    out.push(...(data ?? []));
    if (!data || data.length < 1000) break;
  }
  return out;
}

function useCompetitions() {
  return useQuery({
    queryKey: ["competitions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("competitions").select("*").order("name");
      if (error) throw error;
      return data as Competition[];
    },
  });
}

/** Detalii despre elevi/profesori + clasa elevului. */
async function loadPeople(ids: string[], year: string) {
  const uniq = Array.from(new Set(ids));
  const people: Record<string, Person> = {};
  const classOf: Record<string, string> = {};
  for (let i = 0; i < uniq.length; i += 200) {
    const chunk = uniq.slice(i, i + 200);
    const [{ data: p }, { data: c }] = await Promise.all([
      supabase.from("profiles").select("id, first_name, last_name").in("id", chunk),
      supabase.from("student_class_assignments").select("student_id, academic_year, classes(display_name)").in("student_id", chunk),
    ]);
    for (const x of p ?? []) people[x.id] = x as Person;
    for (const x of (c ?? []) as { student_id: string; academic_year: string; classes: { display_name: string } | null }[]) {
      if (x.academic_year === year || !classOf[x.student_id]) classOf[x.student_id] = x.classes?.display_name ?? "";
    }
  }
  return { people, classOf };
}

export default function CompetitionsPage() {
  const { roles, profile, signOut } = useAuth();
  const navigate = useNavigate();
  const canAdd = roles.some((r) => TEACHER_ROLES.includes(r));
  const canReport = roles.some((r) => REPORT_ROLES.includes(r));
  const isAdmin = roles.includes("admin");
  const defaultTab = canAdd ? "mine" : canReport ? "report" : "admin";

  return (
    <div className="flex min-h-screen flex-col">
      <header className="header-safe fixed top-0 left-0 right-0 z-40 flex h-14 items-center justify-between border-b bg-card px-3 sm:px-4 shadow-sm">
        <button type="button" onClick={() => navigate("/app")} className="flex items-center gap-2 hover:opacity-80">
          <Trophy className="h-6 w-6 text-primary" />
          <span className="font-display text-base sm:text-lg font-semibold">CNCV Concursuri</span>
        </button>
        <div className="flex items-center gap-2">
          <ModuleSwitcher />
          <span className="hidden sm:inline text-sm text-muted-foreground truncate max-w-[160px]">{profile?.display_name}</span>
          <Button variant="ghost" size="icon" onClick={signOut}><LogOut className="h-4 w-4" /></Button>
        </div>
      </header>
      <div className="h-header-safe shrink-0" aria-hidden="true" />
      <main className="flex-1 p-3 sm:p-4 pb-safe">
        <Tabs defaultValue={defaultTab}>
          <TabsList className="mb-4 flex-wrap h-auto">
            {canAdd && <TabsTrigger value="mine">Premiile mele</TabsTrigger>}
            {canReport && <TabsTrigger value="report">Rapoarte</TabsTrigger>}
            {isAdmin && <TabsTrigger value="admin">Concursuri</TabsTrigger>}
          </TabsList>
          {canAdd && <TabsContent value="mine"><MyAwards /></TabsContent>}
          {canReport && <TabsContent value="report"><AwardsReport /></TabsContent>}
          {isAdmin && <TabsContent value="admin"><ManageCompetitions /></TabsContent>}
        </Tabs>
      </main>
    </div>
  );
}

/* ---------------- Premiile mele ---------------- */
function MyAwards() {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: comps = [] } = useCompetitions();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Award | null>(null);
  const year = currentAcademicYear();

  const { data, isLoading } = useQuery({
    queryKey: ["my-awards", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const awards = await fetchAll<Award>((f, t) =>
        supabase.from("competition_awards").select("*").eq("teacher_id", user!.id).order("created_at", { ascending: false }).range(f, t) as never);
      const { people, classOf } = await loadPeople(awards.map((a) => a.student_id), year);
      return { awards, people, classOf };
    },
  });
  const compMap = useMemo(() => Object.fromEntries(comps.map((c) => [c.id, c])), [comps]);

  const remove = async (id: string) => {
    if (!confirm("Ștergi acest premiu?")) return;
    const { error } = await supabase.from("competition_awards").delete().eq("id", id);
    if (error) return toast({ title: "Eroare", description: error.message, variant: "destructive" });
    qc.invalidateQueries({ queryKey: ["my-awards"] });
  };

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-2">
        <CardTitle>Premiile mele</CardTitle>
        <Button onClick={() => { setEditing(null); setOpen(true); }}><Plus className="h-4 w-4 mr-1" />Adaugă premiu</Button>
      </CardHeader>
      <CardContent>
        {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : !data?.awards.length ? (
          <p className="text-sm text-muted-foreground">Nu ai adăugat încă niciun premiu.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader><TableRow>
                <TableHead>Elev</TableHead><TableHead>Clasa</TableHead><TableHead>Catedra</TableHead>
                <TableHead>Concurs</TableHead><TableHead>Etapa</TableHead><TableHead>Premiu</TableHead><TableHead>An</TableHead><TableHead />
              </TableRow></TableHeader>
              <TableBody>
                {data.awards.map((a) => {
                  const c = compMap[a.competition_id];
                  return (
                    <TableRow key={a.id}>
                      <TableCell>{fullName(data.people[a.student_id])}</TableCell>
                      <TableCell>{data.classOf[a.student_id] ?? ""}</TableCell>
                      <TableCell>{c ? DEPARTMENTS[c.department] : ""}</TableCell>
                      <TableCell>{c?.name}</TableCell>
                      <TableCell>{STAGES[a.stage]}</TableCell>
                      <TableCell><Badge variant="secondary">{PRIZES[a.prize]}</Badge></TableCell>
                      <TableCell>{a.academic_year}</TableCell>
                      <TableCell className="whitespace-nowrap">
                        <Button size="icon" variant="ghost" onClick={() => { setEditing(a); setOpen(true); }}><Pencil className="h-4 w-4" /></Button>
                        <Button size="icon" variant="ghost" onClick={() => remove(a.id)}><Trash2 className="h-4 w-4" /></Button>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
      <AwardDialog open={open} onOpenChange={setOpen} editing={editing} competitions={comps}
        onSaved={() => qc.invalidateQueries({ queryKey: ["my-awards"] })} />
    </Card>
  );
}

function AwardDialog({ open, onOpenChange, editing, competitions, onSaved }: {
  open: boolean; onOpenChange: (o: boolean) => void; editing: Award | null; competitions: Competition[]; onSaved: () => void;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const [dept, setDept] = useState<Department | "all">("all");
  const [cat, setCat] = useState<Category | "all">("all");
  const [compTerm, setCompTerm] = useState("");
  const [compId, setCompId] = useState("");
  const [stage, setStage] = useState<Stage | "">("");
  const [prize, setPrize] = useState<Prize | "">("");
  const [students, setStudents] = useState<ProfileSearchResult[]>([]);
  const [term, setTerm] = useState("");
  const [results, setResults] = useState<ProfileSearchResult[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (editing) {
      const c = competitions.find((x) => x.id === editing.competition_id);
      setDept(c?.department ?? "all"); setCat("all"); setCompTerm(""); setCompId(editing.competition_id); setStage(editing.stage); setPrize(editing.prize);
    } else { setDept("all"); setCat("all"); setCompTerm(""); setCompId(""); setStage(""); setPrize(""); setStudents([]); }
    setTerm(""); setResults([]);
  }, [open, editing, competitions]);

  useEffect(() => {
    const t = setTimeout(async () => {
      try { setResults(await searchProfiles(term, ["student"])); } catch { setResults([]); }
    }, 250);
    return () => clearTimeout(t);
  }, [term]);

  const selected = competitions.find((c) => c.id === compId);
  const comps = competitions
    .filter((c) => c.is_active && (dept === "all" || c.department === dept) && (cat === "all" || c.category === cat) && matchesSearch(compTerm, c.name))
    .slice(0, 100);

  const save = async () => {
    if (!user || !compId || !stage || !prize) return toast({ title: "Completează toate câmpurile", variant: "destructive" });
    setSaving(true);
    let error;
    if (editing) {
      ({ error } = await supabase.from("competition_awards").update({ competition_id: compId, stage, prize }).eq("id", editing.id));
    } else {
      if (!students.length) { setSaving(false); return toast({ title: "Selectează cel puțin un elev", variant: "destructive" }); }
      const rows = buildAwardRows({ competitionId: compId, stage, prize, academicYear: currentAcademicYear(), teacherId: user.id }, students.map((s) => s.id));
      ({ error } = await supabase.from("competition_awards").insert(rows));
    }
    setSaving(false);
    if (error) return toast({ title: "Eroare", description: error.message, variant: "destructive" });
    toast({ title: editing ? "Premiu actualizat" : `${students.length} premii salvate` });
    onSaved(); onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>{editing ? "Editează premiul" : "Adaugă premiu"}</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1"><Label>Catedra</Label>
            <Select value={dept} onValueChange={(v) => setDept(v as Department | "all")}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent><SelectItem value="all">Toate catedrele</SelectItem>{Object.entries(DEPARTMENTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Concursul</Label>
            {selected ? (
              <div className="flex items-start justify-between gap-2 rounded-md border p-2 text-sm">
                <div>
                  <div className="font-medium">{selected.name}</div>
                  <div className="text-xs text-muted-foreground">{DEPARTMENTS[selected.department]}{selected.category ? ` • ${CATEGORIES[selected.category]}` : ""}</div>
                </div>
                <Button size="sm" variant="ghost" onClick={() => setCompId("")}>Schimbă</Button>
              </div>
            ) : (
              <div className="space-y-2">
                <Select value={cat} onValueChange={(v) => setCat(v as Category | "all")}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent><SelectItem value="all">Toate tipurile</SelectItem>{Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
                </Select>
                <Input placeholder="Caută concursul" value={compTerm} onChange={(e) => setCompTerm(e.target.value)} />
                <div className="border rounded-md max-h-56 overflow-y-auto">
                  {comps.map((c) => (
                    <button key={c.id} type="button" className="block w-full text-left px-3 py-2 text-sm hover:bg-muted border-b last:border-b-0" onClick={() => { setCompId(c.id); setDept(c.department); }}>
                      {c.name}
                      <span className="block text-xs text-muted-foreground">{DEPARTMENTS[c.department]}{c.category ? ` • ${CATEGORIES[c.category]}` : ""}</span>
                    </button>
                  ))}
                  {!comps.length && <p className="p-3 text-sm text-muted-foreground">Niciun concurs găsit.</p>}
                </div>
              </div>
            )}
          </div>
          <div className="space-y-1"><Label>Etapa</Label>
            <Select value={stage} onValueChange={(v) => setStage(v as Stage)}>
              <SelectTrigger><SelectValue placeholder="Alege etapa" /></SelectTrigger>
              <SelectContent>{Object.entries(STAGES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="space-y-1"><Label>Premiul</Label>
            <Select value={prize} onValueChange={(v) => setPrize(v as Prize)}>
              <SelectTrigger><SelectValue placeholder="Alege premiul" /></SelectTrigger>
              <SelectContent>{Object.entries(PRIZES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
            </Select>
          </div>
          {!editing && (
            <div className="space-y-1">
              <Label>Elevii premiați ({students.length} {students.length === 1 ? "premiu" : "premii"})</Label>
              <div className="flex flex-wrap gap-1">
                {students.map((s) => (
                  <Badge key={s.id} variant="secondary" className="gap-1">
                    {s.last_name} {s.first_name}
                    <button type="button" onClick={() => setStudents(students.filter((x) => x.id !== s.id))}><X className="h-3 w-3" /></button>
                  </Badge>
                ))}
              </div>
              <Input placeholder="Caută elev (minim 2 litere)" value={term} onChange={(e) => setTerm(e.target.value)} />
              {results.length > 0 && (
                <div className="border rounded-md max-h-48 overflow-y-auto">
                  {results.filter((r) => !students.some((s) => s.id === r.id)).map((r) => (
                    <button key={r.id} type="button" className="block w-full text-left px-3 py-2 text-sm hover:bg-muted"
                      onClick={() => { setStudents([...students, r]); setTerm(""); }}>
                      {r.last_name} {r.first_name} <span className="text-muted-foreground">({r.username})</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Anulează</Button>
          <Button onClick={save} disabled={saving}>{saving && <Loader2 className="h-4 w-4 mr-1 animate-spin" />}Salvează</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

/* ---------------- Rapoarte ---------------- */
function AwardsReport() {
  const { data: comps = [] } = useCompetitions();
  const [year, setYear] = useState(currentAcademicYear());
  const [dept, setDept] = useState("all");
  const [comp, setComp] = useState("all");
  const [cat, setCat] = useState("all");
  const [stage, setStage] = useState("all");
  const [prize, setPrize] = useState("all");
  const [cls, setCls] = useState("all");
  const [teacher, setTeacher] = useState("");

  const { data, isLoading } = useQuery({
    queryKey: ["awards-report", year],
    queryFn: async () => {
      const awards = await fetchAll<Award>((f, t) =>
        supabase.from("competition_awards").select("*").eq("academic_year", year).order("id").range(f, t) as never);
      const { people, classOf } = await loadPeople(awards.flatMap((a) => [a.student_id, a.teacher_id]), year);
      return { awards, people, classOf };
    },
  });
  const compMap = useMemo(() => Object.fromEntries(comps.map((c) => [c.id, c])), [comps]);

  const rows = useMemo(() => {
    if (!data) return [];
    return data.awards.map((a) => ({
      a, c: compMap[a.competition_id],
      student: fullName(data.people[a.student_id]),
      teacher: fullName(data.people[a.teacher_id]),
      cls: data.classOf[a.student_id] ?? "",
    })).filter((r) => r.c
      && (dept === "all" || r.c.department === dept)
      && (comp === "all" || r.c.id === comp)
      && (cat === "all" || r.c.category === cat)
      && (stage === "all" || r.a.stage === stage)
      && (prize === "all" || r.a.prize === prize)
      && (cls === "all" || r.cls === cls)
      && matchesSearch(teacher, r.teacher))
      .sort((x, y) => DEPARTMENTS[x.c.department].localeCompare(DEPARTMENTS[y.c.department], "ro")
        || x.c.name.localeCompare(y.c.name, "ro") || x.student.localeCompare(y.student, "ro"));
  }, [data, compMap, dept, comp, cat, stage, prize, cls, teacher]);

  const classes = useMemo(() => Array.from(new Set(Object.values(data?.classOf ?? {}).filter(Boolean))).sort((a, b) => a.localeCompare(b, "ro", { numeric: true })), [data]);
  const byDept = countBy(rows, (r) => DEPARTMENTS[r.c.department]);
  const byPrize = countBy(rows, (r) => PRIZES[r.a.prize]);
  const byStage = countBy(rows, (r) => STAGES[r.a.stage]);
  const y0 = Number(year.slice(0, 4)) || new Date().getFullYear();
  const years = [0, 1, 2, 3].map((i) => `${y0 + 1 - i}-${y0 + 2 - i}`).filter((y) => Number(y.slice(0, 4)) <= Number(currentAcademicYear().slice(0, 4)));
  if (!years.includes(year)) years.unshift(year);

  const headers = ["Elev", "Clasa", "Catedra", "Tip", "Concurs", "Etapa", "Premiu", "Profesor coordonator"];
  const table = rows.map((r) => [r.student, r.cls, DEPARTMENTS[r.c.department], r.c.category ? CATEGORIES[r.c.category] : "", r.c.name, STAGES[r.a.stage], PRIZES[r.a.prize], r.teacher]);
  const totals = (o: Record<string, number>) => Object.entries(o).sort((a, b) => b[1] - a[1]).map(([k, v]) => [k, String(v)]);

  const pdf = () => exportReportPdfSections({
    title: "Raport premii la concursuri", subtitle: `An școlar ${year} • ${rows.length} premii`, filename: `premii-${year}`,
    orientation: "landscape",
    sections: [
      { title: "Pe catedre", headers: ["Catedra", "Premii"], rows: totals(byDept) },
      { title: "Pe premii", headers: ["Premiu", "Număr"], rows: totals(byPrize) },
      { title: "Pe etape", headers: ["Etapa", "Număr"], rows: totals(byStage) },
      { title: "Detaliat", headers, rows: table },
    ],
  });

  const sel = (v: string, set: (s: string) => void, ph: string, opts: [string, string][]) => (
    <Select value={v} onValueChange={set}>
      <SelectTrigger className="w-full sm:w-44"><SelectValue placeholder={ph} /></SelectTrigger>
      <SelectContent><SelectItem value="all">{ph}: toate</SelectItem>{opts.map(([k, l]) => <SelectItem key={k} value={k}>{l}</SelectItem>)}</SelectContent>
    </Select>
  );

  return (
    <div className="space-y-4">
      <Card>
        <CardContent className="pt-4 flex flex-wrap gap-2">
          <Select value={year} onValueChange={setYear}>
            <SelectTrigger className="w-full sm:w-36"><SelectValue /></SelectTrigger>
            <SelectContent>{years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}</SelectContent>
          </Select>
          {sel(dept, (v) => { setDept(v); setComp("all"); }, "Catedra", Object.entries(DEPARTMENTS))}
          {sel(cat, setCat, "Tip", Object.entries(CATEGORIES))}
          {sel(comp, setComp, "Concurs", comps.filter((c) => dept === "all" || c.department === dept).map((c) => [c.id, c.name]))}
          {sel(stage, setStage, "Etapa", Object.entries(STAGES))}
          {sel(prize, setPrize, "Premiu", Object.entries(PRIZES))}
          {sel(cls, setCls, "Clasa", classes.map((c) => [c, c]))}
          <Input className="w-full sm:w-48" placeholder="Profesor" value={teacher} onChange={(e) => setTeacher(e.target.value)} />
          <Button variant="outline" onClick={pdf} disabled={!rows.length}><FileDown className="h-4 w-4 mr-1" />PDF</Button>
          <Button variant="outline" onClick={() => exportToCSV(`premii-${year}`, headers, table)} disabled={!rows.length}><FileDown className="h-4 w-4 mr-1" />CSV</Button>
        </CardContent>
      </Card>
      <div className="grid gap-4 md:grid-cols-3">
        {[["Pe catedre", byDept], ["Pe premii", byPrize], ["Pe etape", byStage]].map(([t, o]) => (
          <Card key={t as string}>
            <CardHeader className="pb-2"><CardTitle className="text-base">{t as string}</CardTitle></CardHeader>
            <CardContent className="text-sm space-y-1">
              {totals(o as Record<string, number>).map(([k, v]) => <div key={k} className="flex justify-between"><span>{k}</span><span className="font-semibold">{v}</span></div>)}
              {!rows.length && <p className="text-muted-foreground">—</p>}
            </CardContent>
          </Card>
        ))}
      </div>
      <Card>
        <CardHeader><CardTitle className="text-base">Premii ({rows.length})</CardTitle></CardHeader>
        <CardContent className="overflow-x-auto">
          {isLoading ? <Loader2 className="h-5 w-5 animate-spin" /> : (
            <Table>
              <TableHeader><TableRow>{headers.map((h) => <TableHead key={h}>{h}</TableHead>)}</TableRow></TableHeader>
              <TableBody>{table.map((r, i) => <TableRow key={i}>{r.map((c, j) => <TableCell key={j}>{c}</TableCell>)}</TableRow>)}</TableBody>
            </Table>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

/* ---------------- Administrare concursuri ---------------- */
function ManageCompetitions() {
  const { toast } = useToast();
  const qc = useQueryClient();
  const { data: comps = [] } = useCompetitions();
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Competition | null>(null);
  const [name, setName] = useState("");
  const [dept, setDept] = useState<Department | "">("");
  const [category, setCategory] = useState<Category | "none">("none");
  const [filter, setFilter] = useState("all");
  const [catFilter, setCatFilter] = useState("all");
  const [term, setTerm] = useState("");

  const openDlg = (c: Competition | null) => { setEditing(c); setName(c?.name ?? ""); setDept(c?.department ?? ""); setCategory(c?.category ?? "none"); setOpen(true); };
  const refresh = () => qc.invalidateQueries({ queryKey: ["competitions"] });

  const save = async () => {
    if (!name.trim() || !dept) return toast({ title: "Completează numele și catedra", variant: "destructive" });
    const payload = { name: name.trim(), department: dept, category: category === "none" ? null : category };
    const { error } = editing
      ? await supabase.from("competitions").update(payload).eq("id", editing.id)
      : await supabase.from("competitions").insert(payload);
    if (error) return toast({ title: "Eroare", description: error.message, variant: "destructive" });
    setOpen(false); refresh();
  };
  const toggle = async (c: Competition) => {
    const { error } = await supabase.from("competitions").update({ is_active: !c.is_active }).eq("id", c.id);
    if (error) return toast({ title: "Eroare", description: error.message, variant: "destructive" });
    refresh();
  };

  const list = comps.filter((c) => (filter === "all" || c.department === filter) && (catFilter === "all" || c.category === catFilter) && matchesSearch(term, c.name))
    .sort((a, b) => DEPARTMENTS[a.department].localeCompare(DEPARTMENTS[b.department], "ro") || a.name.localeCompare(b.name, "ro"));

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2">
        <CardTitle>Concursuri ({list.length})</CardTitle>
        <div className="flex flex-wrap gap-2">
          <Input className="w-56" placeholder="Caută concursul" value={term} onChange={(e) => setTerm(e.target.value)} />
          <Select value={catFilter} onValueChange={setCatFilter}>
            <SelectTrigger className="w-52"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Toate tipurile</SelectItem>{Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-44"><SelectValue /></SelectTrigger>
            <SelectContent><SelectItem value="all">Toate catedrele</SelectItem>{Object.entries(DEPARTMENTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
          </Select>
          <Button onClick={() => openDlg(null)}><Plus className="h-4 w-4 mr-1" />Concurs nou</Button>
        </div>
      </CardHeader>
      <CardContent className="overflow-x-auto">
        <Table>
          <TableHeader><TableRow><TableHead>Catedra</TableHead><TableHead>Tip</TableHead><TableHead>Concurs</TableHead><TableHead>Activ</TableHead><TableHead /></TableRow></TableHeader>
          <TableBody>
            {list.map((c) => (
              <TableRow key={c.id}>
                <TableCell>{DEPARTMENTS[c.department]}</TableCell>
                <TableCell>{c.category ? CATEGORIES[c.category] : "—"}</TableCell>
                <TableCell>{c.name}</TableCell>
                <TableCell><Switch checked={c.is_active} onCheckedChange={() => toggle(c)} /></TableCell>
                <TableCell><Button size="icon" variant="ghost" onClick={() => openDlg(c)}><Pencil className="h-4 w-4" /></Button></TableCell>
              </TableRow>
            ))}
            {!list.length && <TableRow><TableCell colSpan={5} className="text-muted-foreground">Niciun concurs.</TableCell></TableRow>}
          </TableBody>
        </Table>
      </CardContent>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader><DialogTitle>{editing ? "Editează concursul" : "Concurs nou"}</DialogTitle></DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1"><Label>Catedra</Label>
              <Select value={dept} onValueChange={(v) => setDept(v as Department)}>
                <SelectTrigger><SelectValue placeholder="Alege catedra" /></SelectTrigger>
                <SelectContent>{Object.entries(DEPARTMENTS).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Tip</Label>
              <Select value={category} onValueChange={(v) => setCategory(v as Category | "none")}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent><SelectItem value="none">Nespecificat</SelectItem>{Object.entries(CATEGORIES).map(([k, v]) => <SelectItem key={k} value={k}>{v}</SelectItem>)}</SelectContent>
              </Select>
            </div>
            <div className="space-y-1"><Label>Numele concursului</Label><Input value={name} onChange={(e) => setName(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button onClick={save}>Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </Card>
  );
}
