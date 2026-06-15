import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { Plus, Pencil, Trash2, Star } from "lucide-react";
import { toast } from "sonner";
import { JOURNAL_TYPES } from "@/lib/portfolioMisc";

interface Cls { id: string; display_name: string; academic_year: string; }

interface JournalEntry {
  id: string;
  teacher_id: string;
  date: string;
  title: string;
  description: string | null;
  type: string;
  class_id: string | null;
  student_ids: string[];
  results: string | null;
  notes: string | null;
  next_steps: string | null;
  relevant_for_annual_report: boolean;
  academic_year: string | null;
  classes: { display_name: string } | null;
}

const empty = {
  id: null as string | null,
  date: new Date().toISOString().slice(0, 10),
  title: "",
  type: "lectie",
  class_id: "_none",
  description: "",
  results: "",
  notes: "",
  next_steps: "",
  relevant_for_annual_report: false,
  academic_year: "",
};

export default function PortfolioJournalPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [filterType, setFilterType] = useState<string>("_all");
  const [onlyAnnual, setOnlyAnnual] = useState(false);

  const { data: myClasses = [] } = useQuery({
    queryKey: ["portfolio_my_classes_simple", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_teacher_classes")
        .select("classes(id, display_name, academic_year)")
        .eq("teacher_id", user!.id);
      if (error) throw error;
      return ((data ?? []) as any[])
        .map((r) => r.classes as Cls).filter(Boolean)
        .sort((a, b) => a.display_name.localeCompare(b.display_name, "ro"));
    },
  });

  const { data: entries = [], isLoading } = useQuery({
    queryKey: ["portfolio_journal_list", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_journal")
        .select("*, classes(display_name)")
        .eq("teacher_id", user!.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as JournalEntry[];
    },
  });

  const filtered = useMemo(() => entries.filter((e) =>
    (filterType === "_all" || e.type === filterType) &&
    (!onlyAnnual || e.relevant_for_annual_report),
  ), [entries, filterType, onlyAnnual]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Titlul este obligatoriu");
      const cls = myClasses.find((c) => c.id === form.class_id);
      const payload = {
        teacher_id: user!.id,
        date: form.date,
        title: form.title.trim(),
        description: form.description.trim() || null,
        type: form.type,
        class_id: form.class_id === "_none" ? null : form.class_id,
        results: form.results.trim() || null,
        notes: form.notes.trim() || null,
        next_steps: form.next_steps.trim() || null,
        relevant_for_annual_report: form.relevant_for_annual_report,
        academic_year: form.academic_year || cls?.academic_year || null,
      };
      if (form.id) {
        const { error } = await supabase
          .from("portfolio_journal").update(payload).eq("id", form.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("portfolio_journal").insert(payload);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_journal_list"] });
      qc.invalidateQueries({ queryKey: ["portfolio_dashboard_journal"] });
      setOpen(false); setForm(empty);
      toast.success("Salvat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portfolio_journal").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_journal_list"] });
      toast.success("Șters");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() { setForm(empty); setOpen(true); }
  function openEdit(e: JournalEntry) {
    setForm({
      id: e.id,
      date: e.date,
      title: e.title,
      type: e.type,
      class_id: e.class_id ?? "_none",
      description: e.description ?? "",
      results: e.results ?? "",
      notes: e.notes ?? "",
      next_steps: e.next_steps ?? "",
      relevant_for_annual_report: e.relevant_for_annual_report,
      academic_year: e.academic_year ?? "",
    });
    setOpen(true);
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Jurnal profesional</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Notează zilnic activitatea și marchează pentru raportul anual.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Intrare nouă
        </Button>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <Select value={filterType} onValueChange={setFilterType}>
          <SelectTrigger className="w-auto min-w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Toate tipurile</SelectItem>
            {Object.entries(JOURNAL_TYPES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <Switch checked={onlyAnnual} onCheckedChange={setOnlyAnnual} />
          Doar pentru raport anual
        </label>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nicio intrare.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-2">
          {filtered.map((e) => (
            <Card key={e.id}>
              <CardContent className="p-4">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {e.relevant_for_annual_report && (
                        <Star className="h-4 w-4 fill-primary text-primary shrink-0" />
                      )}
                      <div className="font-medium">{e.title}</div>
                    </div>
                    <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                      <span>{new Date(e.date).toLocaleDateString("ro-RO")}</span>
                      <span>{JOURNAL_TYPES[e.type] ?? e.type}</span>
                      {e.classes && <span>{e.classes.display_name}</span>}
                    </div>
                    {e.description && (
                      <p className="text-sm mt-2 whitespace-pre-wrap">{e.description}</p>
                    )}
                    {e.results && (
                      <p className="text-sm mt-1 text-muted-foreground whitespace-pre-wrap">
                        <strong>Rezultate:</strong> {e.results}
                      </p>
                    )}
                    {e.next_steps && (
                      <p className="text-sm mt-1 text-muted-foreground whitespace-pre-wrap">
                        <strong>Pași următori:</strong> {e.next_steps}
                      </p>
                    )}
                    {e.notes && (
                      <p className="text-sm mt-1 text-muted-foreground whitespace-pre-wrap">
                        <strong>Observații:</strong> {e.notes}
                      </p>
                    )}
                  </div>
                  <div className="flex items-center gap-1">
                    <Button variant="ghost" size="icon" onClick={() => openEdit(e)}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon"
                      onClick={() => { if (confirm("Ștergi intrarea?")) deleteMutation.mutate(e.id); }}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editează intrare" : "Intrare nouă"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Data *</Label>
                <DateInput value={form.date} onChange={(v) => setForm({ ...form, date: v })} />
              </div>
              <div>
                <Label>Tip</Label>
                <Select value={form.type} onValueChange={(v) => setForm({ ...form, type: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(JOURNAL_TYPES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Titlu *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div>
              <Label>Clasă (opțional)</Label>
              <Select value={form.class_id} onValueChange={(v) => setForm({ ...form, class_id: v })}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="_none">—</SelectItem>
                  {myClasses.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descriere</Label>
              <Textarea rows={3} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Rezultate</Label>
              <Textarea rows={2} value={form.results}
                onChange={(e) => setForm({ ...form, results: e.target.value })} />
            </div>
            <div>
              <Label>Pași următori</Label>
              <Textarea rows={2} value={form.next_steps}
                onChange={(e) => setForm({ ...form, next_steps: e.target.value })} />
            </div>
            <div>
              <Label>Observații</Label>
              <Textarea rows={2} value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Switch checked={form.relevant_for_annual_report}
                onCheckedChange={(v) => setForm({ ...form, relevant_for_annual_report: v })} />
              Marchează pentru raportul anual
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button disabled={saveMutation.isPending} onClick={() => saveMutation.mutate()}>
              {saveMutation.isPending ? "Se salvează…" : "Salvează"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
