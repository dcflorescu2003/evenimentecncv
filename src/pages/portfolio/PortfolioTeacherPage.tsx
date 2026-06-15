import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
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
import {
  Popover, PopoverContent, PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList,
} from "@/components/ui/command";
import {
  Plus, Pencil, Trash2, FileText, Download, Star, Check, ChevronsUpDown,
} from "lucide-react";
import { toast } from "sonner";
import {
  TEACHER_ITEM_CATEGORIES, uploadPortfolioMiscFile,
} from "@/lib/portfolioMisc";
import {
  formatBytes, getPortfolioFileUrl, deletePortfolioFile,
} from "@/lib/portfolio";
import { cn } from "@/lib/utils";

interface TeacherItem {
  id: string;
  teacher_id: string;
  category: string;
  title: string;
  description: string | null;
  version: string | null;
  year: string | null;
  pinned: boolean;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  created_at: string;
}

interface StudentDiploma {
  id: string;
  teacher_id: string;
  student_id: string;
  contest: string;
  award: string | null;
  date: string | null;
  description: string | null;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  academic_year: string | null;
  created_at: string;
}

interface Student { id: string; first_name: string; last_name: string; }

const emptyItem = {
  id: null as string | null,
  category: "cv",
  title: "",
  description: "",
  version: "",
  year: "",
  pinned: false,
};

const emptyDiploma = {
  id: null as string | null,
  student_id: "",
  contest: "",
  award: "",
  date: "",
  description: "",
  academic_year: "",
};

export default function PortfolioTeacherPage() {
  const { user } = useAuth();
  const qc = useQueryClient();

  // === Teacher items ===
  const [openItem, setOpenItem] = useState(false);
  const [formItem, setFormItem] = useState(emptyItem);
  const [itemFile, setItemFile] = useState<File | null>(null);

  // === Diplomas ===
  const [openDip, setOpenDip] = useState(false);
  const [formDip, setFormDip] = useState(emptyDiploma);
  const [dipFile, setDipFile] = useState<File | null>(null);
  const [studentPickerOpen, setStudentPickerOpen] = useState(false);

  const { data: items = [], isLoading: loadingItems } = useQuery({
    queryKey: ["portfolio_teacher_items", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_teacher_items")
        .select("*")
        .eq("teacher_id", user!.id)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as TeacherItem[];
    },
  });

  const { data: diplomas = [], isLoading: loadingDip } = useQuery({
    queryKey: ["portfolio_teacher_diplomas", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_student_diplomas")
        .select("*")
        .eq("teacher_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as StudentDiploma[];
    },
  });

  const diplomaStudentIds = diplomas.map((d) => d.student_id);

  const { data: knownStudents = [] } = useQuery({
    queryKey: ["portfolio_diploma_students", diplomaStudentIds.join(",")],
    enabled: diplomaStudentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", diplomaStudentIds);
      if (error) throw error;
      return (data ?? []) as Student[];
    },
  });

  const { data: myStudents = [] } = useQuery({
    queryKey: ["portfolio_my_students", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: assigns, error } = await supabase
        .from("portfolio_teacher_classes")
        .select("class_id")
        .eq("teacher_id", user!.id);
      if (error) throw error;
      const classIds = (assigns ?? []).map((a) => a.class_id);
      if (classIds.length === 0) return [] as Student[];
      const { data: sc } = await supabase
        .from("student_class_assignments")
        .select("student_id")
        .in("class_id", classIds);
      const ids = Array.from(new Set((sc ?? []).map((r) => r.student_id)));
      if (ids.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", ids);
      return ((profs ?? []) as Student[])
        .sort((a, b) =>
          a.last_name.localeCompare(b.last_name, "ro") ||
          a.first_name.localeCompare(b.first_name, "ro"),
        );
    },
  });

  const studentName = (sid: string) => {
    const s = knownStudents.find((x) => x.id === sid) ??
              myStudents.find((x) => x.id === sid);
    return s ? `${s.last_name} ${s.first_name}` : "—";
  };

  const groupedItems = useMemo(() => {
    const g: Record<string, TeacherItem[]> = {};
    for (const it of items) {
      const k = it.category || "altele";
      (g[k] ??= []).push(it);
    }
    return g;
  }, [items]);

  // ---- mutations ----
  const saveItem = useMutation({
    mutationFn: async () => {
      if (!formItem.title.trim()) throw new Error("Titlul este obligatoriu");
      const payload = {
        teacher_id: user!.id,
        category: formItem.category,
        title: formItem.title.trim(),
        description: formItem.description.trim() || null,
        version: formItem.version.trim() || null,
        year: formItem.year.trim() || null,
        pinned: formItem.pinned,
      };
      let id = formItem.id;
      if (id) {
        const { error } = await supabase
          .from("portfolio_teacher_items").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("portfolio_teacher_items").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      if (itemFile) {
        const up = await uploadPortfolioMiscFile("teacher-items", id!, itemFile);
        const cur = items.find((i) => i.id === id);
        if (cur?.file_path) { try { await deletePortfolioFile(cur.file_path); } catch { /* */ } }
        const { error } = await supabase.from("portfolio_teacher_items").update({
          file_path: up.path, file_name: up.name,
          file_size: up.size, mime_type: up.type,
        }).eq("id", id!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_teacher_items"] });
      setOpenItem(false); setFormItem(emptyItem); setItemFile(null);
      toast.success("Salvat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteItem = useMutation({
    mutationFn: async (it: TeacherItem) => {
      if (it.file_path) { try { await deletePortfolioFile(it.file_path); } catch { /* */ } }
      const { error } = await supabase.from("portfolio_teacher_items").delete().eq("id", it.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_teacher_items"] });
      toast.success("Șters");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveDiploma = useMutation({
    mutationFn: async () => {
      if (!formDip.student_id) throw new Error("Selectează elevul");
      if (!formDip.contest.trim()) throw new Error("Specifică concursul / activitatea");
      const payload = {
        teacher_id: user!.id,
        student_id: formDip.student_id,
        contest: formDip.contest.trim(),
        award: formDip.award.trim() || null,
        date: formDip.date || null,
        description: formDip.description.trim() || null,
        academic_year: formDip.academic_year.trim() || null,
      };
      let id = formDip.id;
      if (id) {
        const { error } = await supabase
          .from("portfolio_student_diplomas").update(payload).eq("id", id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("portfolio_student_diplomas").insert(payload).select("id").single();
        if (error) throw error;
        id = data.id;
      }
      if (dipFile) {
        const up = await uploadPortfolioMiscFile("student-diplomas", id!, dipFile);
        const cur = diplomas.find((d) => d.id === id);
        if (cur?.file_path) { try { await deletePortfolioFile(cur.file_path); } catch { /* */ } }
        const { error } = await supabase.from("portfolio_student_diplomas").update({
          file_path: up.path, file_name: up.name,
          file_size: up.size, mime_type: up.type,
        }).eq("id", id!);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_teacher_diplomas"] });
      qc.invalidateQueries({ queryKey: ["student_portfolio_items"] });
      setOpenDip(false); setFormDip(emptyDiploma); setDipFile(null);
      toast.success("Diplomă salvată — atașată în portofoliul elevului");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteDiploma = useMutation({
    mutationFn: async (d: StudentDiploma) => {
      if (d.file_path) { try { await deletePortfolioFile(d.file_path); } catch { /* */ } }
      // also remove the auto-attached portfolio item
      await supabase.from("portfolio_items")
        .delete().eq("source", "diploma").eq("source_id", d.id);
      const { error } = await supabase.from("portfolio_student_diplomas").delete().eq("id", d.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_teacher_diplomas"] });
      toast.success("Șters");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreateItem() { setFormItem(emptyItem); setItemFile(null); setOpenItem(true); }
  function openEditItem(it: TeacherItem) {
    setFormItem({
      id: it.id, category: it.category, title: it.title,
      description: it.description ?? "", version: it.version ?? "",
      year: it.year ?? "", pinned: it.pinned,
    });
    setItemFile(null); setOpenItem(true);
  }

  function openCreateDip() { setFormDip(emptyDiploma); setDipFile(null); setOpenDip(true); }
  function openEditDip(d: StudentDiploma) {
    setFormDip({
      id: d.id, student_id: d.student_id, contest: d.contest,
      award: d.award ?? "", date: d.date ?? "",
      description: d.description ?? "", academic_year: d.academic_year ?? "",
    });
    setDipFile(null); setOpenDip(true);
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
      <div>
        <h1 className="font-display text-2xl font-bold">Portofoliul meu profesional</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          CV, certificate, materiale didactice și diplome ale elevilor.
        </p>
      </div>

      <Tabs defaultValue="items">
        <TabsList>
          <TabsTrigger value="items">Materiale personale ({items.length})</TabsTrigger>
          <TabsTrigger value="diplomas">Diplome elevi ({diplomas.length})</TabsTrigger>
        </TabsList>

        <TabsContent value="items" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateItem}>
              <Plus className="h-4 w-4 mr-2" /> Adaugă material
            </Button>
          </div>
          {loadingItems ? (
            <p className="text-sm text-muted-foreground">Se încarcă…</p>
          ) : items.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
              Niciun material adăugat.
            </CardContent></Card>
          ) : (
            Object.entries(groupedItems).map(([cat, list]) => (
              <div key={cat}>
                <h2 className="font-semibold mb-2">
                  {TEACHER_ITEM_CATEGORIES[cat] ?? cat} ({list.length})
                </h2>
                <div className="space-y-2">
                  {list.map((it) => (
                    <Card key={it.id} className={it.pinned ? "border-primary/50" : ""}>
                      <CardContent className="p-4">
                        <div className="flex items-start justify-between gap-2">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2">
                              {it.pinned && <Star className="h-4 w-4 fill-primary text-primary shrink-0" />}
                              <div className="font-medium">{it.title}</div>
                            </div>
                            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                              {it.version && <span>v{it.version}</span>}
                              {it.year && <span>{it.year}</span>}
                            </div>
                            {it.description && (
                              <p className="text-sm mt-1 whitespace-pre-wrap">{it.description}</p>
                            )}
                            {it.file_path && it.file_name && (
                              <button type="button"
                                onClick={() => download(it.file_path!, it.file_name!)}
                                className="mt-2 flex w-full items-center gap-2 rounded-md border px-2 py-1 text-sm hover:bg-muted/50">
                                <FileText className="h-4 w-4" />
                                <span className="truncate flex-1 text-left">{it.file_name}</span>
                                <span className="text-xs text-muted-foreground">{formatBytes(it.file_size)}</span>
                                <Download className="h-4 w-4 text-muted-foreground" />
                              </button>
                            )}
                          </div>
                          <div className="flex items-center gap-1">
                            <Button variant="ghost" size="icon" onClick={() => openEditItem(it)}>
                              <Pencil className="h-4 w-4" />
                            </Button>
                            <Button variant="ghost" size="icon"
                              onClick={() => { if (confirm("Ștergi materialul?")) deleteItem.mutate(it); }}>
                              <Trash2 className="h-4 w-4 text-destructive" />
                            </Button>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            ))
          )}
        </TabsContent>

        <TabsContent value="diplomas" className="mt-4 space-y-4">
          <div className="flex justify-end">
            <Button onClick={openCreateDip}>
              <Plus className="h-4 w-4 mr-2" /> Diplomă nouă
            </Button>
          </div>
          {loadingDip ? (
            <p className="text-sm text-muted-foreground">Se încarcă…</p>
          ) : diplomas.length === 0 ? (
            <Card><CardContent className="p-6 text-center text-sm text-muted-foreground">
              Nicio diplomă încărcată. Vor apărea automat și în portofoliul elevului.
            </CardContent></Card>
          ) : (
            <div className="space-y-2">
              {diplomas.map((d) => (
                <Card key={d.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          🏅 {d.contest}
                          {d.award ? ` — ${d.award}` : ""}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                          <span>{studentName(d.student_id)}</span>
                          {d.date && <span>{new Date(d.date).toLocaleDateString("ro-RO")}</span>}
                          {d.academic_year && <span>{d.academic_year}</span>}
                        </div>
                        {d.description && (
                          <p className="text-sm mt-1 whitespace-pre-wrap">{d.description}</p>
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
                        <Button variant="ghost" size="icon" onClick={() => openEditDip(d)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon"
                          onClick={() => { if (confirm("Ștergi diploma?")) deleteDiploma.mutate(d); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </TabsContent>
      </Tabs>

      {/* Item dialog */}
      <Dialog open={openItem} onOpenChange={setOpenItem}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{formItem.id ? "Editează material" : "Material nou"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Titlu *</Label>
              <Input value={formItem.title}
                onChange={(e) => setFormItem({ ...formItem, title: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Categorie</Label>
                <Select value={formItem.category}
                  onValueChange={(v) => setFormItem({ ...formItem, category: v })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TEACHER_ITEM_CATEGORIES).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label>An / perioadă</Label>
                <Input value={formItem.year}
                  onChange={(e) => setFormItem({ ...formItem, year: e.target.value })}
                  placeholder="2025-2026" />
              </div>
            </div>
            <div>
              <Label>Versiune (opțional)</Label>
              <Input value={formItem.version}
                onChange={(e) => setFormItem({ ...formItem, version: e.target.value })}
                placeholder="ex: v2" />
            </div>
            <div>
              <Label>Descriere</Label>
              <Textarea rows={3} value={formItem.description}
                onChange={(e) => setFormItem({ ...formItem, description: e.target.value })} />
            </div>
            <div>
              <Label>Fișier (max 10 MB, opțional)</Label>
              {formItem.id && items.find((i) => i.id === formItem.id)?.file_name && !itemFile && (
                <p className="text-xs text-muted-foreground mt-1 mb-1">
                  Curent: {items.find((i) => i.id === formItem.id)?.file_name}
                </p>
              )}
              <Input type="file" onChange={(e) => setItemFile(e.target.files?.[0] ?? null)} />
            </div>
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <input type="checkbox" checked={formItem.pinned}
                onChange={(e) => setFormItem({ ...formItem, pinned: e.target.checked })} />
              Fixează în partea de sus
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenItem(false)}>Anulează</Button>
            <Button disabled={saveItem.isPending} onClick={() => saveItem.mutate()}>
              {saveItem.isPending ? "Se salvează…" : "Salvează"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Diploma dialog */}
      <Dialog open={openDip} onOpenChange={setOpenDip}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{formDip.id ? "Editează diplomă" : "Diplomă nouă pentru elev"}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Elev *</Label>
              <Popover open={studentPickerOpen} onOpenChange={setStudentPickerOpen}>
                <PopoverTrigger asChild>
                  <Button variant="outline" role="combobox"
                    className="w-full justify-between">
                    {formDip.student_id
                      ? studentName(formDip.student_id)
                      : "Selectează elevul…"}
                    <ChevronsUpDown className="h-4 w-4 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Caută elev…" />
                    <CommandList>
                      <CommandEmpty>Niciun elev găsit.</CommandEmpty>
                      <CommandGroup>
                        {myStudents.map((s) => (
                          <CommandItem key={s.id} value={`${s.last_name} ${s.first_name}`}
                            onSelect={() => {
                              setFormDip({ ...formDip, student_id: s.id });
                              setStudentPickerOpen(false);
                            }}>
                            <Check className={cn("mr-2 h-4 w-4",
                              formDip.student_id === s.id ? "opacity-100" : "opacity-0")} />
                            {s.last_name} {s.first_name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
            </div>
            <div>
              <Label>Concurs / activitate *</Label>
              <Input value={formDip.contest}
                onChange={(e) => setFormDip({ ...formDip, contest: e.target.value })} />
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <Label>Premiu / mențiune</Label>
                <Input value={formDip.award}
                  onChange={(e) => setFormDip({ ...formDip, award: e.target.value })}
                  placeholder="ex: Premiul I" />
              </div>
              <div>
                <Label>Data</Label>
                <DateInput value={formDip.date}
                  onChange={(v) => setFormDip({ ...formDip, date: v })} />
              </div>
            </div>
            <div>
              <Label>An școlar</Label>
              <Input value={formDip.academic_year}
                onChange={(e) => setFormDip({ ...formDip, academic_year: e.target.value })}
                placeholder="2025-2026" />
            </div>
            <div>
              <Label>Observații</Label>
              <Textarea rows={2} value={formDip.description}
                onChange={(e) => setFormDip({ ...formDip, description: e.target.value })} />
            </div>
            <div>
              <Label>Fișier diplomă (max 10 MB)</Label>
              {formDip.id && diplomas.find((d) => d.id === formDip.id)?.file_name && !dipFile && (
                <p className="text-xs text-muted-foreground mt-1 mb-1">
                  Curent: {diplomas.find((d) => d.id === formDip.id)?.file_name}
                </p>
              )}
              <Input type="file" accept="image/*,application/pdf"
                onChange={(e) => setDipFile(e.target.files?.[0] ?? null)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpenDip(false)}>Anulează</Button>
            <Button disabled={saveDiploma.isPending} onClick={() => saveDiploma.mutate()}>
              {saveDiploma.isPending ? "Se salvează…" : "Salvează"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
