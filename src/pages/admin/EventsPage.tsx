import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
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
import { Checkbox } from "@/components/ui/checkbox";
import { Plus, Pencil, Trash2, Copy, Eye, Search } from "lucide-react";
import { toast } from "sonner";
import type { Tables, TablesInsert } from "@/integrations/supabase/types";
import { isValidTime24h, normalizeTimeInput } from "@/lib/time";

type Event = Tables<"events">;
type Session = Tables<"program_sessions">;
type EventStatus = "draft" | "published" | "closed" | "cancelled";

const statusLabels: Record<EventStatus, string> = {
  draft: "Ciornă",
  published: "Publicat",
  closed: "Închis",
  cancelled: "Anulat",
};

const statusColors: Record<EventStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

const ALL_GRADES = [5, 6, 7, 8, 9, 10, 11, 12];

function computeDuration(start: string, end: string): { display: string; hours: number } {
  if (!start || !end) return { display: "", hours: 0 };
  const [sh, sm] = start.split(":").map(Number);
  const [eh, em] = end.split(":").map(Number);
  const totalMin = (eh * 60 + em) - (sh * 60 + sm);
  if (totalMin <= 0) return { display: "0h", hours: 0 };
  const h = Math.floor(totalMin / 60);
  const m = totalMin % 60;
  const rounded = m >= 30 ? h + 1 : h;
  return { display: `${h}h${m > 0 ? m + "m" : ""}`, hours: Math.max(rounded, 1) };
}

interface EventForm {
  session_id: string;
  title: string;
  description: string;
  date: string;
  start_time: string;
  end_time: string;
  location: string;
  room_details: string;
  max_capacity: number;
  status: EventStatus;
  eligible_grades: number[];
  booking_open_at: string;
  booking_close_at: string;
  notes_for_teachers: string;
  is_public: boolean;
}

const emptyForm: EventForm = {
  session_id: "",
  title: "",
  description: "",
  date: "",
  start_time: "08:00",
  end_time: "10:00",
  location: "",
  room_details: "",
  max_capacity: 30,
  status: "draft",
  eligible_grades: [],
  booking_open_at: "",
  booking_close_at: "",
  notes_for_teachers: "",
  is_public: false,
};

export default function EventsPage() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [filterSession, setFilterSession] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [search, setSearch] = useState("");

  const { data: sessions = [] } = useQuery({
    queryKey: ["program_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("program_sessions").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data as Session[];
    },
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["events"],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as Event[];
    },
  });

  const filtered = events.filter((e) => {
    if (filterSession !== "all" && e.session_id !== filterSession) return false;
    if (filterStatus !== "all" && e.status !== filterStatus) return false;
    if (search && !e.title.toLowerCase().includes(search.toLowerCase())) return false;
    return true;
  });

  const saveMutation = useMutation({
    mutationFn: async (values: EventForm) => {
      const dur = computeDuration(values.start_time, values.end_time);
      const payload = {
        session_id: values.session_id,
        title: values.title,
        description: values.description || null,
        date: values.date,
        start_time: values.start_time,
        end_time: values.end_time,
        computed_duration_display: dur.display,
        counted_duration_hours: dur.hours,
        location: values.location || null,
        room_details: values.room_details || null,
        max_capacity: values.max_capacity,
        status: values.status,
        eligible_grades: values.eligible_grades.length > 0 ? values.eligible_grades : null,
        booking_open_at: values.booking_open_at || null,
        booking_close_at: values.booking_close_at || null,
        notes_for_teachers: values.notes_for_teachers || null,
        published: values.status === "published",
        is_public: values.is_public,
      };

      if (editingId) {
        const { error } = await supabase.from("events").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("events").insert(payload as TablesInsert<"events">);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success(editingId ? "Eveniment actualizat" : "Eveniment creat");
      closeDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("events").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["events"] });
      toast.success("Eveniment șters");
      setDeleteId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openCreate() {
    setEditingId(null);
    setForm({ ...emptyForm, session_id: sessions.find((s) => s.status === "active")?.id || sessions[0]?.id || "" });
    setDialogOpen(true);
  }

  function openEdit(ev: Event) {
    setEditingId(ev.id);
    setForm({
      session_id: ev.session_id,
      title: ev.title,
      description: ev.description || "",
      date: ev.date,
      start_time: ev.start_time?.slice(0, 5),
      end_time: ev.end_time?.slice(0, 5),
      location: ev.location || "",
      room_details: ev.room_details || "",
      max_capacity: ev.max_capacity,
      status: ev.status as EventStatus,
      eligible_grades: (ev.eligible_grades as number[]) || [],
      booking_open_at: ev.booking_open_at ? ev.booking_open_at.slice(0, 16) : "",
      booking_close_at: ev.booking_close_at ? ev.booking_close_at.slice(0, 16) : "",
      notes_for_teachers: ev.notes_for_teachers || "",
      is_public: (ev as any).is_public ?? false,
    });
    setDialogOpen(true);
  }

  function duplicate(ev: Event) {
    setEditingId(null);
    setForm({
      session_id: ev.session_id,
      title: `${ev.title} (copie)`,
      description: ev.description || "",
      date: ev.date,
      start_time: ev.start_time,
      end_time: ev.end_time,
      location: ev.location || "",
      room_details: ev.room_details || "",
      max_capacity: ev.max_capacity,
      status: "draft",
      eligible_grades: (ev.eligible_grades as number[]) || [],
      booking_open_at: "",
      booking_close_at: "",
      notes_for_teachers: ev.notes_for_teachers || "",
      is_public: (ev as any).is_public ?? false,
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
    if (!form.title || !form.date || !form.start_time || !form.end_time) {
      toast.error("Completați toate câmpurile obligatorii");
      return;
    }
    if (!form.is_public && !form.session_id) {
      toast.error("Selectați sesiunea sau marcați evenimentul ca public");
      return;
    }
    if (form.end_time <= form.start_time) {
      toast.error("Ora de sfârșit trebuie să fie după ora de început");
      return;
    }
    saveMutation.mutate(form);
  }

  function toggleGrade(grade: number) {
    setForm((f) => ({
      ...f,
      eligible_grades: f.eligible_grades.includes(grade)
        ? f.eligible_grades.filter((g) => g !== grade)
        : [...f.eligible_grades, grade].sort((a, b) => a - b),
    }));
  }

  const getSessionName = (id: string) => sessions.find((s) => s.id === id)?.name || "—";
  const dur = computeDuration(form.start_time, form.end_time);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Evenimente</h1>
          <p className="mt-1 text-sm text-muted-foreground">Gestionare evenimente pentru sesiunile active.</p>
        </div>
        <Button onClick={openCreate} disabled={sessions.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Eveniment nou
        </Button>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Caută după titlu…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-9"
          />
        </div>
        <Select value={filterSession} onValueChange={setFilterSession}>
          <SelectTrigger className="w-[200px]">
            <SelectValue placeholder="Toate sesiunile" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate sesiunile</SelectItem>
            {sessions.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name}</SelectItem>
            ))}
          </SelectContent>
        </Select>
        <Select value={filterStatus} onValueChange={setFilterStatus}>
          <SelectTrigger className="w-[160px]">
            <SelectValue placeholder="Toate statusurile" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate statusurile</SelectItem>
            {Object.entries(statusLabels).map(([k, v]) => (
              <SelectItem key={k} value={k}>{v}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titlu</TableHead>
              <TableHead>Sesiune</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Interval</TableHead>
              <TableHead>Ore</TableHead>
              <TableHead>Capacitate</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Se încarcă…</TableCell>
              </TableRow>
            ) : filtered.length === 0 ? (
              <TableRow>
                <TableCell colSpan={8} className="py-8 text-center text-muted-foreground">Niciun eveniment găsit</TableCell>
              </TableRow>
            ) : (
              filtered.map((ev) => (
                <TableRow key={ev.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/admin/events/${ev.id}`)}>
                  <TableCell className="font-medium">{ev.title}</TableCell>
                  <TableCell className="text-sm text-muted-foreground">{getSessionName(ev.session_id)}</TableCell>
                  <TableCell>{ev.date}</TableCell>
                  <TableCell>{ev.start_time?.slice(0, 5)} – {ev.end_time?.slice(0, 5)}</TableCell>
                  <TableCell>{ev.counted_duration_hours}h</TableCell>
                  <TableCell>{ev.max_capacity}</TableCell>
                  <TableCell>
                    <Badge variant="secondary" className={statusColors[ev.status as EventStatus]}>
                      {statusLabels[ev.status as EventStatus]}
                    </Badge>
                  </TableCell>
                  <TableCell>
                    <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon" onClick={() => navigate(`/admin/events/${ev.id}`)} title="Detalii">
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => openEdit(ev)} title="Editează">
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => duplicate(ev)} title="Duplică">
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => setDeleteId(ev.id)} title="Șterge">
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
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editare eveniment" : "Eveniment nou"}</DialogTitle>
            <DialogDescription>
              {editingId ? "Modificați detaliile evenimentului." : "Completați detaliile noului eveniment."}
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label htmlFor="ev-title">Titlu *</Label>
                <Input id="ev-title" value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex: Vizită la Muzeu" />
              </div>
              <div className="space-y-2">
                <Label>Sesiune *</Label>
                <Select value={form.session_id} onValueChange={(v) => setForm({ ...form, session_id: v })}>
                  <SelectTrigger><SelectValue placeholder="Alege sesiunea" /></SelectTrigger>
                  <SelectContent>
                    {sessions.map((s) => (
                      <SelectItem key={s.id} value={s.id}>{s.name} ({s.academic_year})</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-date">Data *</Label>
                <Input id="ev-date" type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-start">Ora început *</Label>
                <Input id="ev-start" type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-end">Ora sfârșit *</Label>
                <Input id="ev-end" type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
            </div>
            {dur.hours > 0 && (
              <p className="text-sm text-muted-foreground">
                Durată: {dur.display} → <strong>{dur.hours}h</strong> (ore contorizate)
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ev-loc">Locație</Label>
                <Input id="ev-loc" value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} placeholder="ex: Sala Mare" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-room">Detalii sală</Label>
                <Input id="ev-room" value={form.room_details} onChange={(e) => setForm({ ...form, room_details: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-cap">Capacitate maximă *</Label>
                <Input id="ev-cap" type="number" min={1} value={form.max_capacity} onChange={(e) => setForm({ ...form, max_capacity: parseInt(e.target.value) || 1 })} />
              </div>
              <div className="space-y-2">
                <Label>Status</Label>
                <Select value={form.status} onValueChange={(v) => setForm({ ...form, status: v as EventStatus })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(statusLabels).map(([k, v]) => (
                      <SelectItem key={k} value={k}>{v}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Checkbox
                id="ev-public"
                checked={form.is_public}
                onCheckedChange={(v) => setForm({ ...form, is_public: !!v })}
              />
              <Label htmlFor="ev-public" className="text-sm font-normal cursor-pointer">
                Eveniment public (fără autentificare, vizitatorii pot rezerva locuri)
              </Label>
            </div>
            {!form.is_public && (
            <div className="space-y-2">
              <Label>Clase eligibile (pe nivel)</Label>
              <div className="flex flex-wrap gap-3">
                {ALL_GRADES.map((g) => (
                  <label key={g} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={form.eligible_grades.includes(g)} onCheckedChange={() => toggleGrade(g)} />
                    Clasa {g === 5 ? "a V-a" : g === 6 ? "a VI-a" : g === 7 ? "a VII-a" : g === 8 ? "a VIII-a" : g === 9 ? "a IX-a" : g === 10 ? "a X-a" : g === 11 ? "a XI-a" : "a XII-a"}
                  </label>
                ))}
              </div>
              {form.eligible_grades.length === 0 && (
                <p className="text-xs text-muted-foreground">Nicio selecție = toate clasele sunt eligibile</p>
              )}
            </div>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="ev-bopen">Înscriere deschisă de la</Label>
                <Input id="ev-bopen" type="datetime-local" value={form.booking_open_at} onChange={(e) => setForm({ ...form, booking_open_at: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ev-bclose">Înscriere închisă la</Label>
                <Input id="ev-bclose" type="datetime-local" value={form.booking_close_at} onChange={(e) => setForm({ ...form, booking_close_at: e.target.value })} />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-desc">Descriere</Label>
              <Textarea id="ev-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="ev-notes">Note pentru profesori</Label>
              <Textarea id="ev-notes" value={form.notes_for_teachers} onChange={(e) => setForm({ ...form, notes_for_teachers: e.target.value })} rows={2} />
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
            <AlertDialogTitle>Ștergeți evenimentul?</AlertDialogTitle>
            <AlertDialogDescription>
              Această acțiune nu poate fi anulată. Toate rezervările și biletele asociate vor fi șterse.
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
