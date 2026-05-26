import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Power } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Subject = Tables<"subjects">;

export default function SubjectsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Subject | null>(null);
  const [form, setForm] = useState({ name: "", short_name: "" });
  const [deleteId, setDeleteId] = useState<string | null>(null);

  const { data: subjects = [], isLoading } = useQuery({
    queryKey: ["subjects"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("subjects")
        .select("*")
        .order("name");
      if (error) throw error;
      return (data ?? []) as Subject[];
    },
  });

  const { data: usageCounts = {} } = useQuery({
    queryKey: ["teacher_subjects_counts"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("teacher_subjects")
        .select("subject_id");
      if (error) throw error;
      const counts: Record<string, number> = {};
      for (const r of data ?? []) counts[r.subject_id] = (counts[r.subject_id] ?? 0) + 1;
      return counts;
    },
  });

  const filtered = subjects
    .filter((s) => !search || s.name.toLowerCase().includes(search.toLowerCase()) || (s.short_name ?? "").toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "ro"));

  const upsertMutation = useMutation({
    mutationFn: async () => {
      const name = form.name.trim();
      const short_name = form.short_name.trim() || null;
      if (!name) throw new Error("Numele este obligatoriu");
      if (editing) {
        const { error } = await supabase.from("subjects").update({ name, short_name }).eq("id", editing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("subjects").insert({ name, short_name });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects"] });
      setDialogOpen(false);
      setEditing(null);
      setForm({ name: "", short_name: "" });
      toast.success(editing ? "Materie actualizată" : "Materie adăugată");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggleActiveMutation = useMutation({
    mutationFn: async (s: Subject) => {
      const { error } = await supabase.from("subjects").update({ is_active: !s.is_active }).eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects"] });
      toast.success("Status actualizat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("subjects").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["subjects"] });
      qc.invalidateQueries({ queryKey: ["teacher_subjects_counts"] });
      setDeleteId(null);
      toast.success("Materie ștearsă");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditing(null);
    setForm({ name: "", short_name: "" });
    setDialogOpen(true);
  }

  function openEdit(s: Subject) {
    setEditing(s);
    setForm({ name: s.name, short_name: s.short_name ?? "" });
    setDialogOpen(true);
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Materii</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestionare listă materii predate în școală.
          </p>
        </div>
        <Button onClick={openCreate} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Materie nouă
        </Button>
      </div>

      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          placeholder="Caută materie…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-9"
        />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Denumire</TableHead>
              <TableHead>Abreviere</TableHead>
              <TableHead>Profesori</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Se încarcă…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={5} className="py-8 text-center text-muted-foreground">Nicio materie</TableCell></TableRow>
            ) : (
              filtered.map((s) => {
                const used = usageCounts[s.id] ?? 0;
                return (
                  <TableRow key={s.id}>
                    <TableCell className="font-medium">{s.name}</TableCell>
                    <TableCell className="text-muted-foreground">{s.short_name ?? "—"}</TableCell>
                    <TableCell>
                      <Badge variant="secondary">{used}</Badge>
                    </TableCell>
                    <TableCell>
                      <Badge variant={s.is_active ? "default" : "destructive"}>
                        {s.is_active ? "Activă" : "Inactivă"}
                      </Badge>
                    </TableCell>
                    <TableCell>
                      <div className="flex gap-1">
                        <Button variant="ghost" size="icon" title="Editează" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title={s.is_active ? "Dezactivează" : "Activează"} onClick={() => toggleActiveMutation.mutate(s)}>
                          <Power className={`h-4 w-4 ${s.is_active ? "text-primary" : "text-muted-foreground"}`} />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          title={used > 0 ? "Materia este atribuită unor profesori" : "Șterge"}
                          disabled={used > 0}
                          onClick={() => setDeleteId(s.id)}
                        >
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                );
              })
            )}
          </TableBody>
        </Table>
      </div>

      <Dialog open={dialogOpen} onOpenChange={(o) => { setDialogOpen(o); if (!o) setEditing(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? "Editează materie" : "Materie nouă"}</DialogTitle>
            <DialogDescription>Denumirea trebuie să fie unică.</DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(e) => { e.preventDefault(); upsertMutation.mutate(); }}
            className="space-y-4"
          >
            <div className="space-y-2">
              <Label>Denumire *</Label>
              <Input value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="ex: Matematică" autoFocus />
            </div>
            <div className="space-y-2">
              <Label>Abreviere</Label>
              <Input value={form.short_name} onChange={(e) => setForm({ ...form, short_name: e.target.value })} placeholder="ex: Mate" />
              <p className="text-xs text-muted-foreground">Opțional. Utilă pentru afișări scurte.</p>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setDialogOpen(false)}>Anulează</Button>
              <Button type="submit" disabled={upsertMutation.isPending}>
                {upsertMutation.isPending ? "Se salvează…" : "Salvează"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergere materie</AlertDialogTitle>
            <AlertDialogDescription>Această acțiune este ireversibilă.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
            >
              Șterge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
