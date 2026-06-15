import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { Plus, Pencil, Trash2, ChevronRight, Archive, ArchiveRestore, Trophy } from "lucide-react";
import { toast } from "sonner";
import {
  COMPETITION_TYPE_LABELS, COMPETITION_DIFFICULTY_LABELS, COMPETITION_TEAM_LABELS,
  CompetitionType, CompetitionDifficulty, CompetitionTeamMode,
} from "@/lib/portfolioCompetitions";

interface Cls {
  id: string;
  display_name: string;
  academic_year: string;
}

interface Competition {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  type: string;
  difficulty: string;
  class_ids: string[];
  signup_deadline: string | null;
  event_date: string | null;
  regulation_url: string | null;
  location: string | null;
  seats: number | null;
  team_mode: string;
  status: string;
  academic_year: string | null;
  created_at: string;
}

const emptyForm = {
  id: null as string | null,
  title: "",
  description: "",
  type: "scolar" as CompetitionType,
  difficulty: "mediu" as CompetitionDifficulty,
  class_ids: [] as string[],
  signup_deadline: "",
  event_date: "",
  regulation_url: "",
  location: "",
  seats: "",
  team_mode: "individual" as CompetitionTeamMode,
};

export default function PortfolioCompetitionsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [showArchived, setShowArchived] = useState(false);

  const { data: myClasses = [] } = useQuery({
    queryKey: ["portfolio_my_classes_simple", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_teacher_classes")
        .select("class_id, academic_year, classes(id, display_name, academic_year)")
        .eq("teacher_id", user!.id);
      if (error) throw error;
      return ((data ?? []) as any[])
        .map((r) => r.classes as Cls)
        .filter(Boolean)
        .sort((a, b) => a.display_name.localeCompare(b.display_name, "ro"));
    },
  });

  const { data: competitions = [], isLoading } = useQuery({
    queryKey: ["portfolio_competitions_list", user?.id, showArchived],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_competitions")
        .select("*")
        .eq("teacher_id", user!.id)
        .eq("status", showArchived ? "archived" : "active")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Competition[];
    },
  });

  const signupCounts = useQuery({
    queryKey: ["portfolio_competitions_counts", competitions.map((c) => c.id).join(",")],
    enabled: competitions.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_competition_signups")
        .select("competition_id, status")
        .in("competition_id", competitions.map((c) => c.id));
      if (error) throw error;
      const counts: Record<string, { total: number; interested: number; registered: number }> = {};
      for (const s of (data ?? []) as { competition_id: string; status: string }[]) {
        counts[s.competition_id] ??= { total: 0, interested: 0, registered: 0 };
        counts[s.competition_id].total += 1;
        if (s.status === "interested") counts[s.competition_id].interested += 1;
        if (s.status === "registered" || s.status === "participated") {
          counts[s.competition_id].registered += 1;
        }
      }
      return counts;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (v: typeof emptyForm) => {
      if (!v.title.trim()) throw new Error("Titlul este obligatoriu");
      if (v.class_ids.length === 0) throw new Error("Selectează cel puțin o clasă");
      const ay = myClasses.find((c) => v.class_ids.includes(c.id))?.academic_year ?? null;
      const payload = {
        teacher_id: user!.id,
        title: v.title.trim(),
        description: v.description.trim() || null,
        type: v.type,
        difficulty: v.difficulty,
        class_ids: v.class_ids,
        signup_deadline: v.signup_deadline || null,
        event_date: v.event_date || null,
        regulation_url: v.regulation_url.trim() || null,
        location: v.location.trim() || null,
        seats: v.seats ? Number(v.seats) : null,
        team_mode: v.team_mode,
        academic_year: ay,
      };
      if (v.id) {
        const { error } = await supabase
          .from("portfolio_competitions")
          .update(payload)
          .eq("id", v.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("portfolio_competitions").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_competitions_list"] });
      qc.invalidateQueries({ queryKey: ["portfolio_dashboard_competitions"] });
      setOpen(false);
      setForm(emptyForm);
      toast.success("Salvat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (c: Competition) => {
      const newStatus = c.status === "archived" ? "active" : "archived";
      const { error } = await supabase
        .from("portfolio_competitions")
        .update({ status: newStatus })
        .eq("id", c.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_competitions_list"] });
      toast.success("Actualizat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portfolio_competitions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_competitions_list"] });
      toast.success("Șters");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() { setForm(emptyForm); setOpen(true); }
  function openEdit(c: Competition) {
    setForm({
      id: c.id,
      title: c.title,
      description: c.description ?? "",
      type: c.type as CompetitionType,
      difficulty: c.difficulty as CompetitionDifficulty,
      class_ids: c.class_ids ?? [],
      signup_deadline: c.signup_deadline ?? "",
      event_date: c.event_date ?? "",
      regulation_url: c.regulation_url ?? "",
      location: c.location ?? "",
      seats: c.seats ? String(c.seats) : "",
      team_mode: c.team_mode as CompetitionTeamMode,
    });
    setOpen(true);
  }

  function toggleClass(id: string) {
    setForm((f) => ({
      ...f,
      class_ids: f.class_ids.includes(id)
        ? f.class_ids.filter((x) => x !== id)
        : [...f.class_ids, id],
    }));
  }

  function classNamesFor(ids: string[]) {
    return myClasses
      .filter((c) => ids.includes(c.id))
      .map((c) => c.display_name)
      .join(", ");
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Concursuri</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestionează concursurile la care îți poți implica elevii.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-arc-comp" />
            <Label htmlFor="show-arc-comp" className="cursor-pointer">Arhivate</Label>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Concurs nou
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      ) : competitions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {showArchived ? "Nimic în arhivă." : "Niciun concurs creat încă."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {competitions.map((c) => {
            const cnt = signupCounts.data?.[c.id];
            return (
              <Card key={c.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => navigate(`/portfolio/competitions/${c.id}`)}
                  >
                    <div className="flex items-center gap-2 font-semibold">
                      <Trophy className="h-4 w-4 text-primary shrink-0" />
                      <span className="truncate">{c.title}</span>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span>{COMPETITION_TYPE_LABELS[c.type as CompetitionType] ?? c.type}</span>
                      <span>{COMPETITION_DIFFICULTY_LABELS[c.difficulty as CompetitionDifficulty] ?? c.difficulty}</span>
                      <span>{COMPETITION_TEAM_LABELS[c.team_mode as CompetitionTeamMode] ?? c.team_mode}</span>
                      <span className="truncate">{classNamesFor(c.class_ids ?? [])}</span>
                      {c.event_date && (
                        <span>
                          Concurs:{" "}
                          {new Date(c.event_date).toLocaleDateString("ro-RO", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                          })}
                        </span>
                      )}
                      {c.signup_deadline && (
                        <span>
                          Înscriere până:{" "}
                          {new Date(c.signup_deadline).toLocaleDateString("ro-RO", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                          })}
                        </span>
                      )}
                      <span>
                        {cnt?.total ?? 0} elev(i)
                        {cnt && cnt.interested > 0 ? ` · ${cnt.interested} interesați` : ""}
                        {cnt && cnt.registered > 0 ? ` · ${cnt.registered} înscriși` : ""}
                      </span>
                    </div>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" title="Editează" onClick={() => openEdit(c)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost" size="icon"
                      title={c.status === "archived" ? "Dezarhivează" : "Arhivează"}
                      onClick={() => archiveMutation.mutate(c)}
                    >
                      {c.status === "archived" ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost" size="icon" title="Șterge"
                      onClick={() => {
                        if (confirm("Ștergi concursul? Înscrierile elevilor vor dispărea.")) {
                          deleteMutation.mutate(c.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <Button
                      variant="ghost" size="icon" title="Deschide"
                      onClick={() => navigate(`/portfolio/competitions/${c.id}`)}
                    >
                      <ChevronRight className="h-4 w-4" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editează concurs" : "Concurs nou"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titlu *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Olimpiada de Matematică"
              />
            </div>
            <div>
              <Label>Descriere</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={3}
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-3">
              <div>
                <Label>Tip</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v as CompetitionType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPETITION_TYPE_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Dificultate</Label>
                <Select value={form.difficulty} onValueChange={(v) => setForm({ ...form, difficulty: v as CompetitionDifficulty })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPETITION_DIFFICULTY_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Participare</Label>
                <Select value={form.team_mode} onValueChange={(v) => setForm({ ...form, team_mode: v as CompetitionTeamMode })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(COMPETITION_TEAM_LABELS).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Clase vizate *</Label>
              {myClasses.length === 0 ? (
                <p className="text-xs text-muted-foreground mt-1">
                  Adaugă mai întâi clase în „Clase și elevi".
                </p>
              ) : (
                <div className="mt-1 space-y-1 max-h-40 overflow-y-auto rounded-md border p-2">
                  {myClasses.map((c) => (
                    <label key={c.id} className="flex items-center gap-2 cursor-pointer text-sm py-0.5">
                      <Checkbox
                        checked={form.class_ids.includes(c.id)}
                        onCheckedChange={() => toggleClass(c.id)}
                      />
                      <span>{c.display_name} · {c.academic_year}</span>
                    </label>
                  ))}
                </div>
              )}
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Termen înscriere</Label>
                <DateInput
                  value={form.signup_deadline}
                  onChange={(v) => setForm({ ...form, signup_deadline: v })}
                />
              </div>
              <div>
                <Label>Data concursului</Label>
                <DateInput
                  value={form.event_date}
                  onChange={(v) => setForm({ ...form, event_date: v })}
                />
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Loc desfășurare</Label>
                <Input
                  value={form.location}
                  onChange={(e) => setForm({ ...form, location: e.target.value })}
                />
              </div>
              <div>
                <Label>Locuri disponibile (opțional)</Label>
                <Input
                  type="number" min={0}
                  value={form.seats}
                  onChange={(e) => setForm({ ...form, seats: e.target.value })}
                />
              </div>
            </div>
            <div>
              <Label>Link regulament</Label>
              <Input
                type="url"
                value={form.regulation_url}
                onChange={(e) => setForm({ ...form, regulation_url: e.target.value })}
                placeholder="https://…"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button
              disabled={saveMutation.isPending}
              onClick={() => saveMutation.mutate(form)}
            >
              {saveMutation.isPending ? "Se salvează…" : "Salvează"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
