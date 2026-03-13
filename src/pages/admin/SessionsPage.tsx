import { formatDate } from "@/lib/time";
import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { toast } from "sonner";
import type { Tables, TablesInsert, TablesUpdate } from "@/integrations/supabase/types";

type Session = Tables<"program_sessions">;
type SessionInsert = TablesInsert<"program_sessions">;
type SessionStatus = "draft" | "active" | "closed" | "archived";

const statusLabels: Record<SessionStatus, string> = {
  draft: "Ciornă",
  active: "Activă",
  closed: "Închisă",
  archived: "Arhivată",
};

const statusColors: Record<SessionStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  active: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  archived: "bg-gray-100 text-gray-600 dark:bg-gray-800 dark:text-gray-400",
};

const emptyForm = {
  name: "",
  academic_year: "2025-2026",
  start_date: "",
  end_date: "",
  status: "draft" as SessionStatus,
};

export default function SessionsPage() {
  const queryClient = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState(emptyForm);

  const { data: sessions = [], isLoading } = useQuery({
    queryKey: ["program_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_sessions")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as Session[];
    },
  });

  const saveMutation = useMutation({
    mutationFn: async (values: typeof form) => {
      if (editingId) {
        const { error } = await supabase
          .from("program_sessions")
          .update(values as TablesUpdate<"program_sessions">)
          .eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("program_sessions")
          .insert(values as SessionInsert);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program_sessions"] });
      toast.success(editingId ? "Sesiune actualizată" : "Sesiune creată");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("program_sessions").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["program_sessions"] });
      toast.success("Sesiune ștearsă");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditingId(null);
    setForm(emptyForm);
    setDialogOpen(true);
  }

  function openEdit(s: Session) {
    setEditingId(s.id);
    setForm({
      name: s.name,
      academic_year: s.academic_year,
      start_date: s.start_date,
      end_date: s.end_date,
      status: s.status as SessionStatus,
    });
    setDialogOpen(true);
  }

  function closeDialog() {
    setDialogOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name || !form.start_date || !form.end_date || !form.academic_year) {
      toast.error("Completați toate câmpurile obligatorii");
      return;
    }
    if (form.end_date < form.start_date) {
      toast.error("Data de sfârșit trebuie să fie după data de început");
      return;
    }
    saveMutation.mutate(form);
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Sesiuni program</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestionare sesiuni: Școala Altfel, Săptămâna Verde etc.
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="mr-2 h-4 w-4" /> Sesiune nouă
        </Button>
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Nume</TableHead>
              <TableHead>An școlar</TableHead>
              <TableHead>Perioada</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-24">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Se încarcă…
                </TableCell>
              </TableRow>
            ) : sessions.length === 0 ? (
              <TableRow>
                <TableCell colSpan={5} className="text-center py-8 text-muted-foreground">
                  Nicio sesiune creată
                </TableCell>
              </TableRow>
            ) : (
              sessions.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.name}</TableCell>
                  <TableCell>{s.academic_year}</TableCell>
                  <TableCell>{formatDate(s.start_date)} — {formatDate(s.end_date)}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[s.status as SessionStatus]}>
                      {statusLabels[s.status as SessionStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button variant="ghost" size="icon" onClick={() => openEdit(s)}>
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(s.id)}>
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingId ? "Editare sesiune" : "Sesiune nouă"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modificați detaliile sesiunii." : "Completați detaliile noii sesiuni."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Nume sesiune *</Label>
              <Input
                id="name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="ex: Școala Altfel"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="academic_year">An școlar *</Label>
              <Input
                id="academic_year"
                value={form.academic_year}
                onChange={(e) => setForm({ ...form, academic_year: e.target.value })}
                placeholder="2025-2026"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="start_date">Data început *</Label>
                <DateInput
                  id="start_date"
                  value={form.start_date}
                  onChange={(v) => setForm({ ...form, start_date: v })}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="end_date">Data sfârșit *</Label>
                <DateInput
                  id="end_date"
                  value={form.end_date}
                  onChange={(v) => setForm({ ...form, end_date: v })}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label>Status</Label>
              <Select
                value={form.status}
                onValueChange={(v) => setForm({ ...form, status: v as SessionStatus })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(statusLabels).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeDialog}>Anulează</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Se salvează…" : "Salvează"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergeți sesiunea?</AlertDialogTitle>
            <AlertDialogDescription>
              Această acțiune nu poate fi anulată. Evenimentele asociate vor rămâne fără sesiune.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deleteId && deleteMutation.mutate(deleteId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Șterge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
