import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { DateInput } from "@/components/ui/date-input";
import { Plus, Pencil, Trash2, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import {
  DOCUMENT_CATEGORIES, DOCUMENT_STATUSES,
  uploadPortfolioMiscFile, documentStatusColor,
} from "@/lib/portfolioMisc";
import {
  formatBytes, getPortfolioFileUrl, deletePortfolioFile,
} from "@/lib/portfolio";

interface Cls { id: string; display_name: string; academic_year: string; }

interface Doc {
  id: string;
  teacher_id: string;
  title: string;
  category: string;
  description: string | null;
  class_id: string | null;
  academic_year: string | null;
  deadline: string | null;
  status: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
  classes: { display_name: string } | null;
}

const empty = {
  id: null as string | null,
  title: "",
  category: "planificari",
  description: "",
  class_id: "_none",
  academic_year: "",
  deadline: "",
  status: "in_progress",
};

export default function PortfolioDocumentsPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState(empty);
  const [file, setFile] = useState<File | null>(null);
  const [filterCat, setFilterCat] = useState<string>("_all");
  const [filterYear, setFilterYear] = useState<string>("_all");

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
        .map((r) => r.classes as Cls)
        .filter(Boolean)
        .sort((a, b) => a.display_name.localeCompare(b.display_name, "ro"));
    },
  });

  const { data: docs = [], isLoading } = useQuery({
    queryKey: ["portfolio_documents_list", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_documents")
        .select("*, classes(display_name)")
        .eq("teacher_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Doc[];
    },
  });

  const years = useMemo(() => {
    const s = new Set<string>();
    for (const d of docs) if (d.academic_year) s.add(d.academic_year);
    return Array.from(s).sort().reverse();
  }, [docs]);

  const filtered = docs.filter((d) =>
    (filterCat === "_all" || d.category === filterCat) &&
    (filterYear === "_all" || d.academic_year === filterYear),
  );

  const grouped = useMemo(() => {
    const g: Record<string, Doc[]> = {};
    for (const d of filtered) {
      const k = d.category || "altele";
      (g[k] ??= []).push(d);
    }
    return g;
  }, [filtered]);

  const saveMutation = useMutation({
    mutationFn: async () => {
      if (!form.title.trim()) throw new Error("Titlul este obligatoriu");
      const cls = myClasses.find((c) => c.id === form.class_id);
      const payload = {
        teacher_id: user!.id,
        title: form.title.trim(),
        category: form.category,
        description: form.description.trim() || null,
        class_id: form.class_id === "_none" ? null : form.class_id,
        academic_year: form.academic_year || cls?.academic_year || null,
        deadline: form.deadline || null,
        status: form.status,
      };
      let docId = form.id;
      if (docId) {
        const { error } = await supabase
          .from("portfolio_documents")
          .update(payload)
          .eq("id", docId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("portfolio_documents")
          .insert(payload).select("id").single();
        if (error) throw error;
        docId = data.id;
      }
      if (file) {
        const up = await uploadPortfolioMiscFile("documents", docId!, file);
        const cur = docs.find((d) => d.id === docId);
        if (cur?.file_path) {
          try { await deletePortfolioFile(cur.file_path); } catch { /* */ }
        }
        const { error } = await supabase.from("portfolio_documents").update({
          file_path: up.path, file_name: up.name,
          file_size: up.size, mime_type: up.type,
        }).eq("id", docId!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_documents_list"] });
      qc.invalidateQueries({ queryKey: ["portfolio_dashboard_documents"] });
      setOpen(false); setForm(empty); setFile(null);
      toast.success("Salvat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (d: Doc) => {
      if (d.file_path) { try { await deletePortfolioFile(d.file_path); } catch { /* */ } }
      const { error } = await supabase.from("portfolio_documents").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_documents_list"] });
      toast.success("Șters");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() { setForm(empty); setFile(null); setOpen(true); }
  function openEdit(d: Doc) {
    setForm({
      id: d.id,
      title: d.title,
      category: d.category,
      description: d.description ?? "",
      class_id: d.class_id ?? "_none",
      academic_year: d.academic_year ?? "",
      deadline: d.deadline ?? "",
      status: d.status,
    });
    setFile(null);
    setOpen(true);
  }

  async function download(path: string, name: string) {
    try {
      const url = await getPortfolioFileUrl(path);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.target = "_blank"; a.rel = "noopener"; a.click();
    } catch (e) { toast.error((e as Error).message); }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Documente</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Planificări, programe, rapoarte și alte documente birocratice.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Document nou
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Select value={filterCat} onValueChange={setFilterCat}>
          <SelectTrigger className="w-auto min-w-[180px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Toate categoriile</SelectItem>
            {Object.entries(DOCUMENT_CATEGORIES).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterYear} onValueChange={setFilterYear}>
          <SelectTrigger className="w-auto min-w-[140px]"><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="_all">Toți anii</SelectItem>
            {years.map((y) => <SelectItem key={y} value={y}>{y}</SelectItem>)}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      ) : filtered.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Niciun document.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {Object.entries(grouped).map(([cat, list]) => (
            <div key={cat}>
              <h2 className="font-semibold mb-2">
                {DOCUMENT_CATEGORIES[cat] ?? cat} ({list.length})
              </h2>
              <div className="space-y-2">
                {list.map((d) => (
                  <Card key={d.id}>
                    <CardContent className="p-4">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <div className="font-medium">{d.title}</div>
                          <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                            <span className={documentStatusColor(d.status)}>
                              {DOCUMENT_STATUSES[d.status] ?? d.status}
                            </span>
                            {d.classes && <span>{d.classes.display_name}</span>}
                            {d.academic_year && <span>{d.academic_year}</span>}
                            {d.deadline && (
                              <span>Termen: {new Date(d.deadline).toLocaleDateString("ro-RO")}</span>
                            )}
                          </div>
                          {d.description && (
                            <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{d.description}</p>
                          )}
                          {d.file_path && d.file_name && (
                            <button type="button"
                              onClick={() => download(d.file_path!, d.file_name!)}
                              className="mt-2 flex w-full items-center gap-2 rounded-md border px-2 py-1 text-sm hover:bg-muted/50">
                              <FileText className="h-4 w-4" />
                              <span className="truncate flex-1 text-left">{d.file_name}</span>
                              <span className="text-xs text-muted-foreground">{formatBytes(d.file_size)}</span>
                              <Download className="h-4 w-4 text-muted-foreground" />
                            </button>
                          )}
                        </div>
                        <div className="flex items-center gap-1">
                          <Button variant="ghost" size="icon" onClick={() => openEdit(d)}>
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon"
                            onClick={() => { if (confirm("Ștergi documentul?")) deleteMutation.mutate(d); }}>
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{form.id ? "Editează document" : "Document nou"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titlu *</Label>
              <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Categorie</Label>
                <Select value={form.category} onValueChange={(v) => setForm({ ...form, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_CATEGORIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(DOCUMENT_STATUSES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
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
                <Label>An școlar (ex. 2025-2026)</Label>
                <Input value={form.academic_year}
                  onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                  placeholder="2025-2026" />
              </div>
            </div>
            <div>
              <Label>Termen (opțional)</Label>
              <DateInput value={form.deadline} onChange={(v) => setForm({ ...form, deadline: v })} />
            </div>
            <div>
              <Label>Observații</Label>
              <Textarea rows={3} value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })} />
            </div>
            <div>
              <Label>Fișier (max 10 MB, opțional)</Label>
              {form.id && docs.find((d) => d.id === form.id)?.file_name && !file && (
                <p className="text-xs text-muted-foreground mt-1 mb-1">
                  Curent: {docs.find((d) => d.id === form.id)?.file_name}
                </p>
              )}
              <Input type="file" onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
            </div>
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
