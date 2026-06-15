import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { Plus, Pencil, Trash2, ChevronRight, Archive, ArchiveRestore } from "lucide-react";
import { toast } from "sonner";

interface Cls {
  id: string;
  display_name: string;
  academic_year: string;
}

interface Assignment {
  id: string;
  teacher_id: string;
  class_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  allow_files: boolean;
  allow_text: boolean;
  academic_year: string | null;
  archived: boolean;
  created_at: string;
  classes: Cls | null;
}

const emptyForm = {
  id: null as string | null,
  title: "",
  description: "",
  class_id: "_all",
  due_date: "",
  allow_files: true,
  allow_text: true,
};

export default function PortfolioAssignmentsPage() {
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

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["portfolio_assignments_list", user?.id, showArchived],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_assignments")
        .select("*, classes(id, display_name, academic_year)")
        .eq("teacher_id", user!.id)
        .eq("archived", showArchived)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Assignment[];
    },
  });

  const submissionCounts = useQuery({
    queryKey: ["portfolio_assignment_counts", assignments.map((a) => a.id).join(",")],
    enabled: assignments.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_submissions")
        .select("assignment_id, status")
        .in("assignment_id", assignments.map((a) => a.id));
      if (error) throw error;
      const counts: Record<string, { total: number; pending: number }> = {};
      for (const s of (data ?? []) as { assignment_id: string; status: string }[]) {
        counts[s.assignment_id] ??= { total: 0, pending: 0 };
        counts[s.assignment_id].total += 1;
        if (s.status === "pending") counts[s.assignment_id].pending += 1;
      }
      return counts;
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof emptyForm) => {
      if (!values.title.trim()) throw new Error("Titlul este obligatoriu");
      const payload = {
        teacher_id: user!.id,
        title: values.title.trim(),
        description: values.description.trim() || null,
        class_id: values.class_id === "_all" ? null : values.class_id,
        due_date: values.due_date || null,
        allow_files: values.allow_files,
        allow_text: values.allow_text,
        academic_year:
          values.class_id === "_all"
            ? null
            : myClasses.find((c) => c.id === values.class_id)?.academic_year ?? null,
      };
      if (values.id) {
        const { error } = await supabase
          .from("portfolio_assignments")
          .update(payload)
          .eq("id", values.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("portfolio_assignments").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_assignments_list"] });
      qc.invalidateQueries({ queryKey: ["portfolio_dashboard_assignments"] });
      setOpen(false);
      setForm(emptyForm);
      toast.success("Salvat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const archiveMutation = useMutation({
    mutationFn: async (a: Assignment) => {
      const { error } = await supabase
        .from("portfolio_assignments")
        .update({ archived: !a.archived })
        .eq("id", a.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_assignments_list"] });
      toast.success("Actualizat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portfolio_assignments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_assignments_list"] });
      toast.success("Șters");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setForm(emptyForm);
    setOpen(true);
  }
  function openEdit(a: Assignment) {
    setForm({
      id: a.id,
      title: a.title,
      description: a.description ?? "",
      class_id: a.class_id ?? "_all",
      due_date: a.due_date ?? "",
      allow_files: a.allow_files,
      allow_text: a.allow_text,
    });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Teme de portofoliu</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Creează teme și revizuiește trimiterile elevilor.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-2 text-sm">
            <Switch checked={showArchived} onCheckedChange={setShowArchived} id="show-archived" />
            <Label htmlFor="show-archived" className="cursor-pointer">Arhivate</Label>
          </div>
          <Button onClick={openCreate}>
            <Plus className="mr-2 h-4 w-4" /> Temă nouă
          </Button>
        </div>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            {showArchived ? "Nicio temă arhivată." : "Nu ai creat încă nicio temă."}
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {assignments.map((a) => {
            const c = submissionCounts.data?.[a.id];
            return (
              <Card key={a.id}>
                <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center">
                  <button
                    className="min-w-0 flex-1 text-left"
                    onClick={() => navigate(`/portfolio/assignments/${a.id}`)}
                  >
                    <div className="font-semibold truncate">{a.title}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                      <span>{a.classes?.display_name ?? "Toate clasele mele"}</span>
                      {a.due_date && (
                        <span>
                          Termen:{" "}
                          {new Date(a.due_date).toLocaleDateString("ro-RO", {
                            day: "2-digit", month: "2-digit", year: "numeric",
                          })}
                        </span>
                      )}
                      <span>
                        Trimiteri: {c?.total ?? 0}
                        {c && c.pending > 0 ? ` · ${c.pending} de revizuit` : ""}
                      </span>
                    </div>
                  </button>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" title="Editează" onClick={() => openEdit(a)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title={a.archived ? "Dezarhivează" : "Arhivează"}
                      onClick={() => archiveMutation.mutate(a)}
                    >
                      {a.archived ? <ArchiveRestore className="h-4 w-4" /> : <Archive className="h-4 w-4" />}
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Șterge"
                      onClick={() => {
                        if (confirm("Ștergi tema? Trimiterile elevilor vor dispărea.")) {
                          deleteMutation.mutate(a.id);
                        }
                      }}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      title="Deschide"
                      onClick={() => navigate(`/portfolio/assignments/${a.id}`)}
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
        <DialogContent className="max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editează tema" : "Temă nouă"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titlu *</Label>
              <Input
                value={form.title}
                onChange={(e) => setForm({ ...form, title: e.target.value })}
                placeholder="Ex: Eseu Eminescu"
              />
            </div>
            <div>
              <Label>Descriere</Label>
              <Textarea
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
                rows={4}
                placeholder="Cerințe, format, observații…"
              />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Clasă</Label>
                <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selectează…" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="_all">Toate clasele mele</SelectItem>
                    {myClasses.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.display_name} · {c.academic_year}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Termen limită (opțional)</Label>
                <DateInput
                  value={form.due_date}
                  onChange={(v) => setForm({ ...form, due_date: v })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Elevii pot trimite</Label>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="allow-text"
                  checked={form.allow_text}
                  onCheckedChange={(v) => setForm({ ...form, allow_text: !!v })}
                />
                <Label htmlFor="allow-text" className="cursor-pointer font-normal">Text</Label>
              </div>
              <div className="flex items-center gap-2">
                <Checkbox
                  id="allow-files"
                  checked={form.allow_files}
                  onCheckedChange={(v) => setForm({ ...form, allow_files: !!v })}
                />
                <Label htmlFor="allow-files" className="cursor-pointer font-normal">Fișiere</Label>
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button
              disabled={saveMutation.isPending || (!form.allow_text && !form.allow_files)}
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
