import { useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Users, ArrowRight, HeartHandshake, CalendarRange, Trash2, Megaphone } from "lucide-react";
import { CseBadge } from "@/components/CseBadge";
import { toast } from "sonner";
import { formatDate } from "@/lib/time";
import { DateInput } from "@/components/ui/date-input";
import { ClassEligibilityPicker } from "./ClassEligibilityPicker";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Separator } from "@/components/ui/separator";

type Mode = "admin" | "cse" | "student";

interface Props {
  mode: Mode;
}

/**
 * Hub unificat pentru modulul Cluburi & Voluntariat.
 * Afișează întâi proiectele de voluntariat active, apoi cluburile.
 * - admin/cse: pot crea cluburi și proiecte
 * - student: doar vede + se înscrie din pagina detaliu
 */
export default function ClubsVolunteerHub({ mode }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();

  const detailBase =
    mode === "admin" ? "/admin" : mode === "cse" ? "/prof" : "/student";

  // Sesiunea curentă (activă) — folosită la creare
  const { data: activeSession } = useQuery({
    queryKey: ["active-session"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_sessions")
        .select("id, name, academic_year, status")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: clubs = [], isLoading: loadingClubs } = useQuery({
    queryKey: ["clubs-hub", mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("clubs")
        .select("id, name, description, frequency_label, status, max_capacity, enrollment_open_at, enrollment_close_at, created_by, is_cse")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: projects = [], isLoading: loadingProjects } = useQuery({
    queryKey: ["volunteer-hub", mode],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("volunteer_projects")
        .select("id, name, description, start_date, end_date, status, max_capacity, created_by")
        .order("start_date", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const visibleClubs = useMemo(() => {
    const list = mode === "student" ? clubs.filter((c: any) => c.status === "active") : [...clubs];
    return list.sort((a: any, b: any) =>
      (a.name || "").localeCompare(b.name || "", "ro", { sensitivity: "base" })
    );
  }, [clubs, mode]);

  const visibleProjects = useMemo(() => {
    const list = mode === "student" ? projects.filter((p: any) => p.status === "active") : [...projects];
    const now = Date.now();
    return list.sort((a: any, b: any) => {
      const da = a.start_date ? new Date(a.start_date).getTime() : Infinity;
      const db = b.start_date ? new Date(b.start_date).getTime() : Infinity;
      const fa = da >= now ? da - now : Infinity;
      const fb = db >= now ? db - now : Infinity;
      if (fa !== fb) return fa - fb;
      return da - db;
    });
  }, [projects, mode]);

  const canCreate = mode === "admin" || mode === "cse";

  return (
    <div className="space-y-8">
      <div className="flex flex-col items-start gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
        <div>
          <h1 className="font-display text-2xl font-semibold">Cluburi & Voluntariat</h1>
          <p className="text-sm text-muted-foreground">
            {mode === "student"
              ? "Vezi cluburile disponibile și proiectele de voluntariat. Te poți înscrie sau retrage din pagina fiecăruia."
              : "Gestionează cluburile recurente și proiectele de voluntariat."}
          </p>
        </div>
      </div>

      {/* === VOLUNTARIAT === */}
      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <HeartHandshake className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">
              Voluntariat {mode === "student" ? "activ" : ""}
            </h2>
          </div>
          {canCreate && (
            <CreateProjectDialog
              sessionId={activeSession?.id}
              userId={user!.id}
              onCreated={() => qc.invalidateQueries({ queryKey: ["volunteer-hub", mode] })}
            />
          )}
        </div>
        {loadingProjects ? (
          <p className="text-sm text-muted-foreground">Se încarcă…</p>
        ) : visibleProjects.length === 0 ? (
          <p className="text-sm text-muted-foreground">Niciun proiect de voluntariat momentan.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleProjects.map((p: any) => (
              <Card key={p.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{p.name}</CardTitle>
                    <StatusBadge status={p.status} />
                  </div>
                  <CardDescription className="text-xs">
                    {formatDate(p.start_date)} – {formatDate(p.end_date)}
                  </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-3">
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {p.description || "Fără descriere"}
                  </p>
                  <div className="flex flex-wrap gap-2 self-end">
                    {canCreate && p.status === "draft" && (
                      <DeleteDraftButton
                        table="volunteer_projects"
                        id={p.id}
                        name={p.name}
                        onDeleted={() => qc.invalidateQueries({ queryKey: ["volunteer-hub", mode] })}
                      />
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`${detailBase}/volunteer/${p.id}`)}
                    >
                      Deschide <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <Separator />

      {/* === CLUBURI === */}
      <section className="space-y-3">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-primary" />
            <h2 className="text-lg font-semibold">Cluburi</h2>
          </div>
          {canCreate && (
            <CreateClubDialog
              sessionId={activeSession?.id}
              userId={user!.id}
              onCreated={() => qc.invalidateQueries({ queryKey: ["clubs-hub", mode] })}
            />
          )}
        </div>
        {loadingClubs ? (
          <p className="text-sm text-muted-foreground">Se încarcă…</p>
        ) : visibleClubs.length === 0 ? (
          <p className="text-sm text-muted-foreground">Niciun club momentan.</p>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {visibleClubs.map((c: any) => (
              <Card key={c.id} className="flex flex-col">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between gap-2">
                    <CardTitle className="text-base">{c.name}</CardTitle>
                    <StatusBadge status={c.status} />
                  </div>
                  {c.frequency_label && (
                    <CardDescription className="text-xs flex items-center gap-1">
                      <CalendarRange className="h-3 w-3" />
                      {c.frequency_label}
                    </CardDescription>
                  )}
                </CardHeader>
                <CardContent className="flex flex-1 flex-col justify-between gap-3">
                  <p className="line-clamp-3 text-sm text-muted-foreground">
                    {c.description || "Fără descriere"}
                  </p>
                  <div className="flex flex-wrap gap-2 self-end">
                    {canCreate && c.status === "draft" && (
                      <DeleteDraftButton
                        table="clubs"
                        id={c.id}
                        name={c.name}
                        onDeleted={() => qc.invalidateQueries({ queryKey: ["clubs-hub", mode] })}
                      />
                    )}
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => navigate(`${detailBase}/clubs/${c.id}`)}
                    >
                      Deschide <ArrowRight className="ml-1 h-3 w-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const map: Record<string, { label: string; variant: "default" | "secondary" | "outline" }> = {
    draft: { label: "Ciornă", variant: "outline" },
    active: { label: "Activ", variant: "default" },
    archived: { label: "Arhivat", variant: "secondary" },
    closed: { label: "Închis", variant: "secondary" },
  };
  const cfg = map[status] ?? { label: status, variant: "outline" as const };
  return <Badge variant={cfg.variant}>{cfg.label}</Badge>;
}

function combineDateTime(date: string, time: string): string | null {
  if (!date) return null;
  const t = time && /^\d{2}:\d{2}$/.test(time) ? time : "00:00";
  return new Date(`${date}T${t}:00`).toISOString();
}

function CreateClubDialog({
  sessionId,
  userId,
  onCreated,
}: {
  sessionId?: string;
  userId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [frequency, setFrequency] = useState("");
  const [maxCap, setMaxCap] = useState<string>("");
  const [maxPerClass, setMaxPerClass] = useState<string>("");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [eligibleGrades, setEligibleGrades] = useState<number[]>([]);
  const [eligibleClasses, setEligibleClasses] = useState<string[]>([]);
  const [enrollOpenDate, setEnrollOpenDate] = useState("");
  const [enrollOpenTime, setEnrollOpenTime] = useState("08:00");
  const [enrollCloseDate, setEnrollCloseDate] = useState("");
  const [enrollCloseTime, setEnrollCloseTime] = useState("23:59");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName(""); setDescription(""); setFrequency(""); setMaxCap(""); setMaxPerClass("");
    setStatus("draft"); setEligibleGrades([]); setEligibleClasses([]);
    setEnrollOpenDate(""); setEnrollOpenTime("08:00");
    setEnrollCloseDate(""); setEnrollCloseTime("23:59");
  }

  async function submit() {
    if (!name.trim()) {
      toast.error("Numele clubului este obligatoriu");
      return;
    }
    if (!sessionId) {
      toast.error("Nu există o sesiune activă");
      return;
    }
    setSaving(true);
    const { error } = await supabase.from("clubs").insert({
      session_id: sessionId,
      name: name.trim(),
      description: description.trim() || null,
      frequency_label: frequency.trim() || null,
      max_capacity: maxCap ? Number(maxCap) : null,
      max_per_class: maxPerClass ? Number(maxPerClass) : null,
      eligible_grades: eligibleGrades.length > 0 ? eligibleGrades : null,
      eligible_classes: eligibleClasses.length > 0 ? eligibleClasses : null,
      enrollment_open_at: combineDateTime(enrollOpenDate, enrollOpenTime),
      enrollment_close_at: combineDateTime(enrollCloseDate, enrollCloseTime),
      status,
      created_by: userId,
    });
    setSaving(false);
    if (error) {
      toast.error("Eroare la creare: " + error.message);
      return;
    }
    toast.success("Club creat");
    setOpen(false);
    reset();
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm"><Plus className="h-4 w-4 mr-1" />Club nou</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Club nou</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nume *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Descriere</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="space-y-1">
            <Label>Frecvență (ex: Săptămânal Joi 15:00)</Label>
            <Input value={frequency} onChange={(e) => setFrequency(e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Capacitate maximă</Label>
              <Input type="number" min={1} value={maxCap} onChange={(e) => setMaxCap(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Maxim per clasă</Label>
              <Input type="number" min={1} placeholder="Fără limită" value={maxPerClass} onChange={(e) => setMaxPerClass(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Ciornă</SelectItem>
                  <SelectItem value="active">Activ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <ClassEligibilityPicker
            eligibleGrades={eligibleGrades}
            eligibleClasses={eligibleClasses}
            onChange={({ eligibleGrades: g, eligibleClasses: c }) => {
              setEligibleGrades(g); setEligibleClasses(c);
            }}
          />

          <div className="space-y-2">
            <Label>Perioada de înscriere</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">De la</Label>
                <div className="flex gap-2">
                  <DateInput value={enrollOpenDate} onChange={setEnrollOpenDate} />
                  <Input type="time" value={enrollOpenTime} onChange={(e) => setEnrollOpenTime(e.target.value)} className="w-28" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Până la</Label>
                <div className="flex gap-2">
                  <DateInput value={enrollCloseDate} onChange={setEnrollCloseDate} />
                  <Input type="time" value={enrollCloseTime} onChange={(e) => setEnrollCloseTime(e.target.value)} className="w-28" />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Lasă gol pentru înscrieri permanent deschise.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Se salvează…" : "Creează"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function CreateProjectDialog({
  sessionId,
  userId,
  onCreated,
}: {
  sessionId?: string;
  userId: string;
  onCreated: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [maxCap, setMaxCap] = useState<string>("");
  const [maxPerClass, setMaxPerClass] = useState<string>("");
  const [status, setStatus] = useState<"draft" | "active">("draft");
  const [eligibleGrades, setEligibleGrades] = useState<number[]>([]);
  const [eligibleClasses, setEligibleClasses] = useState<string[]>([]);
  const [enrollOpenDate, setEnrollOpenDate] = useState("");
  const [enrollOpenTime, setEnrollOpenTime] = useState("08:00");
  const [enrollCloseDate, setEnrollCloseDate] = useState("");
  const [enrollCloseTime, setEnrollCloseTime] = useState("23:59");
  const [saving, setSaving] = useState(false);

  function reset() {
    setName(""); setDescription(""); setStartDate(""); setEndDate("");
    setMaxCap(""); setMaxPerClass(""); setStatus("draft");
    setEligibleGrades([]); setEligibleClasses([]);
    setEnrollOpenDate(""); setEnrollOpenTime("08:00");
    setEnrollCloseDate(""); setEnrollCloseTime("23:59");
  }

  async function submit() {
    if (!name.trim()) return toast.error("Numele proiectului este obligatoriu");
    if (!startDate || !endDate) return toast.error("Setează perioada proiectului");
    if (!sessionId) return toast.error("Nu există o sesiune activă");
    setSaving(true);
    const { error } = await supabase.from("volunteer_projects").insert({
      session_id: sessionId,
      name: name.trim(),
      description: description.trim() || null,
      start_date: startDate,
      end_date: endDate,
      max_capacity: maxCap ? Number(maxCap) : null,
      max_per_class: maxPerClass ? Number(maxPerClass) : null,
      eligible_grades: eligibleGrades.length > 0 ? eligibleGrades : null,
      eligible_classes: eligibleClasses.length > 0 ? eligibleClasses : null,
      enrollment_open_at: combineDateTime(enrollOpenDate, enrollOpenTime),
      enrollment_close_at: combineDateTime(enrollCloseDate, enrollCloseTime),
      status,
      created_by: userId,
    });
    setSaving(false);
    if (error) return toast.error("Eroare: " + error.message);
    toast.success("Proiect creat");
    setOpen(false);
    reset();
    onCreated();
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" variant="secondary"><Plus className="h-4 w-4 mr-1" />Proiect nou</Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Proiect voluntariat nou</DialogTitle></DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1">
            <Label>Nume *</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1">
            <Label>Descriere</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label>Început *</Label>
              <DateInput value={startDate} onChange={setStartDate} />
            </div>
            <div className="space-y-1">
              <Label>Sfârșit *</Label>
              <DateInput value={endDate} onChange={setEndDate} />
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1">
              <Label>Capacitate maximă</Label>
              <Input type="number" min={1} value={maxCap} onChange={(e) => setMaxCap(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Maxim per clasă</Label>
              <Input type="number" min={1} placeholder="Fără limită" value={maxPerClass} onChange={(e) => setMaxPerClass(e.target.value)} />
            </div>
            <div className="space-y-1">
              <Label>Status</Label>
              <Select value={status} onValueChange={(v) => setStatus(v as any)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="draft">Ciornă</SelectItem>
                  <SelectItem value="active">Activ</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <ClassEligibilityPicker
            eligibleGrades={eligibleGrades}
            eligibleClasses={eligibleClasses}
            onChange={({ eligibleGrades: g, eligibleClasses: c }) => {
              setEligibleGrades(g); setEligibleClasses(c);
            }}
          />

          <div className="space-y-2">
            <Label>Perioada de înscriere</Label>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">De la</Label>
                <div className="flex gap-2">
                  <DateInput value={enrollOpenDate} onChange={setEnrollOpenDate} />
                  <Input type="time" value={enrollOpenTime} onChange={(e) => setEnrollOpenTime(e.target.value)} className="w-28" />
                </div>
              </div>
              <div className="space-y-1">
                <Label className="text-xs text-muted-foreground">Până la</Label>
                <div className="flex gap-2">
                  <DateInput value={enrollCloseDate} onChange={setEnrollCloseDate} />
                  <Input type="time" value={enrollCloseTime} onChange={(e) => setEnrollCloseTime(e.target.value)} className="w-28" />
                </div>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Lasă gol pentru înscrieri permanent deschise.</p>
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
          <Button onClick={submit} disabled={saving}>{saving ? "Se salvează…" : "Creează"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function DeleteDraftButton({
  table,
  id,
  name,
  onDeleted,
}: {
  table: "clubs" | "volunteer_projects";
  id: string;
  name: string;
  onDeleted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  async function handleDelete() {
    setDeleting(true);
    const { error } = await supabase.from(table).delete().eq("id", id);
    setDeleting(false);
    if (error) {
      toast.error("Eroare la ștergere: " + error.message);
      return;
    }
    toast.success("Ciornă ștearsă");
    setOpen(false);
    onDeleted();
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <Button size="sm" variant="destructive">
          <Trash2 className="h-3 w-3 mr-1" />
          Șterge
        </Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Ștergi ciorna „{name}"?</AlertDialogTitle>
          <AlertDialogDescription>
            Această acțiune este definitivă și nu poate fi anulată.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={deleting}>Anulează</AlertDialogCancel>
          <AlertDialogAction onClick={handleDelete} disabled={deleting}>
            {deleting ? "Se șterge…" : "Șterge"}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
