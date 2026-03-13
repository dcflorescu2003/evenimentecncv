import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DateInput } from "@/components/ui/date-input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Eye, Search } from "lucide-react";
import { toast } from "sonner";
import { formatDate, isValidTime24h, normalizeTimeInput } from "@/lib/time";

type EventStatus = "draft" | "published" | "closed" | "cancelled";

const statusLabels: Record<EventStatus, string> = {
  draft: "Ciornă", published: "Publicat", closed: "Închis", cancelled: "Anulat",
};
const statusColors: Record<EventStatus, string> = {
  draft: "bg-muted text-muted-foreground",
  published: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  closed: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
};

function computeDuration(start: string, end: string) {
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
  eligible_classes: string[];
  booking_open_date: string;
  booking_open_time: string;
  booking_close_date: string;
  booking_close_time: string;
  notes_for_teachers: string;
  is_public: boolean;
}

const emptyForm: EventForm = {
  session_id: "", title: "", description: "", date: "",
  start_time: "08:00", end_time: "10:00", location: "", room_details: "",
  max_capacity: 30, status: "draft", eligible_grades: [], eligible_classes: [],
  booking_open_date: "", booking_open_time: "",
  booking_close_date: "", booking_close_time: "",
  notes_for_teachers: "", is_public: false,
};

function splitDatetime(dt: string | null): { date: string; time: string } {
  if (!dt) return { date: "", time: "" };
  const d = new Date(dt);
  if (isNaN(d.getTime())) return { date: "", time: "" };
  return {
    date: d.toISOString().slice(0, 10),
    time: `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`,
  };
}

function joinDatetime(date: string, time: string): string | null {
  if (!date) return null;
  const t = time || "00:00";
  return `${date}T${t}:00`;
}

export default function ProfEventsPage() {
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<EventForm>(emptyForm);
  const [search, setSearch] = useState("");

  const { data: sessions = [] } = useQuery({
    queryKey: ["program_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase.from("program_sessions").select("*").order("start_date", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: classes = [] } = useQuery({
    queryKey: ["active_classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, display_name, grade_number, section")
        .eq("is_active", true)
        .order("grade_number")
        .order("section");
      if (error) throw error;
      return data;
    },
  });

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["prof_events", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("created_by", user!.id)
        .order("date", { ascending: false });
      if (error) throw error;
      return data;
    },
    enabled: !!user,
  });

  const filtered = events.filter((e) =>
    !search || e.title.toLowerCase().includes(search.toLowerCase())
  );

  const saveMutation = useMutation({
    mutationFn: async (values: EventForm) => {
      const dur = computeDuration(values.start_time, values.end_time);
      const payload: any = {
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
        eligible_classes: values.eligible_classes.length > 0 ? values.eligible_classes : null,
        booking_open_at: joinDatetime(values.booking_open_date, values.booking_open_time),
        booking_close_at: joinDatetime(values.booking_close_date, values.booking_close_time),
        notes_for_teachers: values.notes_for_teachers || null,
        published: values.status === "published",
        is_public: values.is_public,
        created_by: user!.id,
      };
      if (editingId) {
        const { error } = await supabase.from("events").update(payload).eq("id", editingId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase.from("events").insert(payload).select().single();
        if (error) throw error;
        // Auto-assign self as coordinator
        await supabase.from("coordinator_assignments").insert({
          event_id: data.id,
          teacher_id: user!.id,
        });
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["prof_events"] });
      queryClient.invalidateQueries({ queryKey: ["prof_coord_assignments"] });
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
      queryClient.invalidateQueries({ queryKey: ["prof_events"] });
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

  function openEdit(ev: any) {
    const openAt = splitDatetime(ev.booking_open_at);
    const closeAt = splitDatetime(ev.booking_close_at);
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
      status: ev.status,
      eligible_grades: (ev.eligible_grades as number[]) || [],
      eligible_classes: (ev.eligible_classes as string[]) || [],
      booking_open_date: openAt.date,
      booking_open_time: openAt.time,
      booking_close_date: closeAt.date,
      booking_close_time: closeAt.time,
      notes_for_teachers: ev.notes_for_teachers || "",
      is_public: ev.is_public ?? false,
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
      toast.error("Selectați sesiunea sau marcați ca public");
      return;
    }
    if (!isValidTime24h(form.start_time) || !isValidTime24h(form.end_time)) {
      toast.error("Orele trebuie în format 24h HH:MM (00:00–23:59)");
      return;
    }
    if (form.end_time <= form.start_time) {
      toast.error("Ora de sfârșit trebuie să fie după ora de început");
      return;
    }
    saveMutation.mutate(form);
  }

  function toggleGrade(grade: number) {
    setForm((f) => {
      const newGrades = f.eligible_grades.includes(grade)
        ? f.eligible_grades.filter((g) => g !== grade)
        : [...f.eligible_grades, grade].sort((a, b) => a - b);
      const gradeClassIds = classes.filter((c) => c.grade_number === grade).map((c) => c.id);
      let newClasses: string[];
      if (newGrades.includes(grade)) {
        newClasses = [...new Set([...f.eligible_classes, ...gradeClassIds])];
      } else {
        newClasses = f.eligible_classes.filter((id) => !gradeClassIds.includes(id));
      }
      return { ...f, eligible_grades: newGrades, eligible_classes: newClasses };
    });
  }

  function toggleClass(classId: string, gradeNumber: number) {
    setForm((f) => {
      const newClasses = f.eligible_classes.includes(classId)
        ? f.eligible_classes.filter((id) => id !== classId)
        : [...f.eligible_classes, classId];
      const gradeClassIds = classes.filter((c) => c.grade_number === gradeNumber).map((c) => c.id);
      const allSelected = gradeClassIds.every((id) => newClasses.includes(id));
      const noneSelected = gradeClassIds.every((id) => !newClasses.includes(id));
      let newGrades = [...f.eligible_grades];
      if (allSelected && !newGrades.includes(gradeNumber)) {
        newGrades = [...newGrades, gradeNumber].sort((a, b) => a - b);
      } else if (noneSelected) {
        newGrades = newGrades.filter((g) => g !== gradeNumber);
      }
      return { ...f, eligible_classes: newClasses, eligible_grades: newGrades };
    });
  }

  const dur = computeDuration(form.start_time, form.end_time);
  const getSessionName = (id: string) => sessions.find((s) => s.id === id)?.name || "—";

  const classesByGrade = classes.reduce((acc, c) => {
    if (!acc[c.grade_number]) acc[c.grade_number] = [];
    acc[c.grade_number].push(c);
    return acc;
  }, {} as Record<number, typeof classes>);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Evenimentele mele</h1>
          <p className="mt-1 text-sm text-muted-foreground">Creează și gestionează evenimente.</p>
        </div>
        <Button onClick={openCreate} disabled={sessions.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Eveniment nou
        </Button>
      </div>

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Caută…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Titlu</TableHead>
              <TableHead>Data</TableHead>
              <TableHead>Interval</TableHead>
              <TableHead>Ore</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-28">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Se încarcă…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={6} className="py-8 text-center text-muted-foreground">Niciun eveniment</TableCell></TableRow>
            ) : filtered.map((ev) => (
              <TableRow key={ev.id} className="cursor-pointer hover:bg-muted/50" onClick={() => navigate(`/prof/events/${ev.id}`)}>
                <TableCell className="font-medium">{ev.title}</TableCell>
                <TableCell>{formatDate(ev.date)}</TableCell>
                <TableCell>{ev.start_time?.slice(0, 5)} – {ev.end_time?.slice(0, 5)}</TableCell>
                <TableCell>{ev.counted_duration_hours}h</TableCell>
                <TableCell>
                  <Badge variant="secondary" className={statusColors[ev.status as EventStatus]}>
                    {statusLabels[ev.status as EventStatus]}
                  </Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                    <Button variant="ghost" size="icon" onClick={() => openEdit(ev)} title="Editează">
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" onClick={() => setDeleteId(ev.id)} title="Șterge">
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      {/* Create/Edit Dialog */}
      <Dialog open={dialogOpen} onOpenChange={(o) => !o && closeDialog()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{editingId ? "Editare eveniment" : "Eveniment nou"}</DialogTitle>
            <DialogDescription>{editingId ? "Modificați detaliile." : "Completați detaliile noului eveniment."}</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 space-y-2">
                <Label>Titlu *</Label>
                <Input value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="ex: Vizită la Muzeu" />
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
                <Label>Data *</Label>
                <Input type="date" value={form.date} onChange={(e) => setForm({ ...form, date: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Ora început *</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="HH:MM"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: normalizeTimeInput(e.target.value) })}
                />
              </div>
              <div className="space-y-2">
                <Label>Ora sfârșit *</Label>
                <Input
                  type="text"
                  inputMode="numeric"
                  maxLength={5}
                  placeholder="HH:MM"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: normalizeTimeInput(e.target.value) })}
                />
              </div>
            </div>
            {dur.hours > 0 && (
              <p className="text-sm text-muted-foreground">Durată: {dur.display} → <strong>{dur.hours}h</strong></p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>Locație</Label>
                <Input value={form.location} onChange={(e) => setForm({ ...form, location: e.target.value })} />
              </div>
              <div className="space-y-2">
                <Label>Capacitate maximă *</Label>
                <Input type="number" min={1} value={form.max_capacity} onChange={(e) => setForm({ ...form, max_capacity: parseInt(e.target.value) || 1 })} />
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
            <div className="space-y-2">
              <Label>Descriere</Label>
              <Textarea value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={3} />
            </div>
            {!form.is_public && (
              <div className="space-y-3">
                <Label>Clase eligibile</Label>
                <div className="space-y-2 max-h-48 overflow-y-auto rounded-md border p-3">
                  {Object.entries(classesByGrade).sort(([a], [b]) => Number(a) - Number(b)).map(([grade, gradeClasses]) => {
                    const gradeNum = Number(grade);
                    const allClassIds = gradeClasses.map((c) => c.id);
                    const allSelected = allClassIds.every((id) => form.eligible_classes.includes(id));
                    const someSelected = allClassIds.some((id) => form.eligible_classes.includes(id));
                    return (
                      <div key={grade}>
                        <label className="flex items-center gap-1.5 text-sm font-medium cursor-pointer">
                          <Checkbox
                            checked={allSelected}
                            onCheckedChange={() => toggleGrade(gradeNum)}
                            className={someSelected && !allSelected ? "opacity-60" : ""}
                          />
                          Clasa {grade}
                        </label>
                        <div className="ml-6 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                          {gradeClasses.map((c) => (
                            <label key={c.id} className="flex items-center gap-1 text-sm cursor-pointer">
                              <Checkbox
                                checked={form.eligible_classes.includes(c.id)}
                                onCheckedChange={() => toggleClass(c.id, gradeNum)}
                              />
                              {c.display_name}
                            </label>
                          ))}
                        </div>
                      </div>
                    );
                  })}
                </div>
                {form.eligible_classes.length === 0 && form.eligible_grades.length === 0 && (
                  <p className="text-xs text-muted-foreground">Nicio selecție = toate clasele sunt eligibile</p>
                )}
              </div>
            )}
            <div className="space-y-2">
              <Label>Perioada de înscriere</Label>
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">De la - Data</Label>
                  <Input type="date" value={form.booking_open_date} onChange={(e) => setForm({ ...form, booking_open_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">De la - Ora</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="HH:MM"
                    value={form.booking_open_time}
                    onChange={(e) => setForm({ ...form, booking_open_time: normalizeTimeInput(e.target.value) })}
                  />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Până la - Data</Label>
                  <Input type="date" value={form.booking_close_date} onChange={(e) => setForm({ ...form, booking_close_date: e.target.value })} />
                </div>
                <div className="space-y-1">
                  <Label className="text-xs text-muted-foreground">Până la - Ora</Label>
                  <Input
                    type="text"
                    inputMode="numeric"
                    maxLength={5}
                    placeholder="HH:MM"
                    value={form.booking_close_time}
                    onChange={(e) => setForm({ ...form, booking_close_time: normalizeTimeInput(e.target.value) })}
                  />
                </div>
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={form.is_public} onCheckedChange={(c) => setForm({ ...form, is_public: !!c })} />
              Eveniment public (permite rezervări fără cont)
            </label>
            <div className="flex justify-end gap-2">
              <Button type="button" variant="outline" onClick={closeDialog}>Anulează</Button>
              <Button type="submit" disabled={saveMutation.isPending}>
                {saveMutation.isPending ? "Se salvează…" : editingId ? "Salvează" : "Creează"}
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete confirmation */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Șterge evenimentul?</AlertDialogTitle>
            <AlertDialogDescription>Această acțiune este ireversibilă.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteId && deleteMutation.mutate(deleteId)}>Șterge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
