import { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  VR_SLOTS,
  WEEKDAY_LABELS,
  addDays,
  dateToIso,
  hhmm,
  isoToDisplay,
  startOfWeek,
} from "@/lib/smartlab";
import { VrReservationDialog, type VrReservationEdit } from "@/components/smartlab/VrReservationDialog";
import { ChevronLeft, ChevronRight, Plus, CheckCircle2, Loader2, Trash2, Pencil } from "lucide-react";

interface Reservation {
  id: string;
  date: string;
  start_time: string;
  class_id: string;
  room_id: string;
  teacher_id: string;
  notes: string | null;
  status: string;
  prepared_at: string | null;
  classes: { display_name: string } | null;
  vr_rooms: { name: string } | null;
}

const BOOKING_ROLES = ["admin", "teacher", "homeroom_teacher", "cse", "manager"];

export default function SmartLabPage() {
  const { user, roles } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const isAdmin = roles.includes("admin");
  const canBook = roles.some((r) => BOOKING_ROLES.includes(r));
  const isStaff = canBook || roles.includes("coordinator_teacher");

  const [weekStart, setWeekStart] = useState(() => startOfWeek(new Date()));
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<VrReservationEdit | null>(null);
  const [prefill, setPrefill] = useState<{ date?: string; time?: string }>({});
  const [detail, setDetail] = useState<Reservation | null>(null);

  const days = useMemo(
    () => Array.from({ length: 5 }, (_, i) => addDays(weekStart, i)),
    [weekStart],
  );
  const from = dateToIso(days[0]);
  const to = dateToIso(days[4]);

  const { data: reservations, isLoading } = useQuery({
    queryKey: ["vr-reservations", from, to],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vr_reservations")
        .select(
          "id, date, start_time, class_id, room_id, teacher_id, notes, status, prepared_at, classes(display_name), vr_rooms(name)",
        )
        .eq("status", "active")
        .gte("date", from)
        .lte("date", to);
      if (error) throw error;
      return (data ?? []) as unknown as Reservation[];
    },
  });

  const teacherIds = useMemo(
    () => Array.from(new Set((reservations ?? []).map((r) => r.teacher_id))),
    [reservations],
  );

  const { data: teachers } = useQuery({
    queryKey: ["vr-teacher-names", teacherIds],
    enabled: teacherIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.rpc(
        "get_vr_reservation_teacher_names" as never,
        { _ids: teacherIds } as never,
      );
      if (error) throw error;
      const map: Record<string, string> = {};
      ((data ?? []) as { id: string; first_name: string; last_name: string }[]).forEach(
        (p) => (map[p.id] = `${p.last_name} ${p.first_name}`),
      );
      return map;
    },
  });

  const byKey = useMemo(() => {
    const m: Record<string, Reservation> = {};
    (reservations ?? []).forEach((r) => (m[`${r.date}|${hhmm(r.start_time)}`] = r));
    return m;
  }, [reservations]);

  // Rezervările mele (viitoare)
  const { data: mine } = useQuery({
    queryKey: ["vr-reservations", "mine", user?.id],
    enabled: !!user && canBook,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vr_reservations")
        .select("id, date, start_time, class_id, room_id, teacher_id, notes, status, prepared_at, classes(display_name), vr_rooms(name)")
        .eq("teacher_id", user!.id)
        .eq("status", "active")
        .gte("date", dateToIso(new Date()))
        .order("date")
        .order("start_time");
      if (error) throw error;
      return (data ?? []) as unknown as Reservation[];
    },
  });

  // Vizualizare voluntar: rezervări la clasele unde este voluntar
  const { data: volunteerRes } = useQuery({
    queryKey: ["vr-reservations", "volunteer", user?.id],
    enabled: !!user && !isStaff,
    queryFn: async () => {
      const { data: vols } = await supabase
        .from("vr_volunteers")
        .select("class_id")
        .eq("student_id", user!.id);
      const classIds = (vols ?? []).map((v) => v.class_id);
      if (classIds.length === 0) return { classIds, list: [] as Reservation[] };
      const { data, error } = await supabase
        .from("vr_reservations")
        .select("id, date, start_time, class_id, room_id, teacher_id, notes, status, prepared_at, classes(display_name), vr_rooms(name)")
        .in("class_id", classIds)
        .eq("status", "active")
        .gte("date", dateToIso(new Date()))
        .order("date")
        .order("start_time");
      if (error) throw error;
      return { classIds, list: (data ?? []) as unknown as Reservation[] };
    },
  });

  async function cancelReservation(r: Reservation) {
    const { error } = await supabase
      .from("vr_reservations")
      .update({ status: "cancelled" })
      .eq("id", r.id);
    if (error) {
      toast({ title: "Nu am putut anula rezervarea.", variant: "destructive" });
      return;
    }
    await supabase.functions.invoke("notify-vr-reservation", {
      body: { reservation_id: r.id, action: "cancelled" },
    });
    await qc.invalidateQueries({ queryKey: ["vr-reservations"] });
    setDetail(null);
    toast({ title: "Rezervare anulată." });
  }

  async function togglePrepared(r: Reservation) {
    const { data, error } = await supabase.rpc("vr_mark_prepared", {
      _reservation_id: r.id,
      _prepared: !r.prepared_at,
    });
    const res = data as { ok?: boolean; message?: string } | null;
    if (error || !res?.ok) {
      toast({ title: res?.message ?? "Acțiune eșuată.", variant: "destructive" });
      return;
    }
    await qc.invalidateQueries({ queryKey: ["vr-reservations"] });
    toast({ title: !r.prepared_at ? "Marcat ca pregătit." : "Marcaj eliminat." });
  }

  function openNew(date?: string, time?: string) {
    setEditing(null);
    setPrefill({ date, time });
    setDialogOpen(true);
  }

  const materialsQuery = useQuery({
    queryKey: ["vr-res-materials", detail?.id],
    enabled: !!detail,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vr_reservation_materials")
        .select("vr_materials(id, name, subject, preview_url)")
        .eq("reservation_id", detail!.id);
      if (error) throw error;
      return (data ?? []).map(
        (x) => (x as { vr_materials: { id: string; name: string; subject: string; preview_url: string | null } | null }).vr_materials,
      ).filter(Boolean) as { id: string; name: string; subject: string; preview_url: string | null }[];
    },
  });

  const myClassIds = volunteerRes?.classIds ?? [];
  const volunteerList = volunteerRes?.list ?? [];

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="font-display text-2xl font-semibold">Rezervări echipamente VR</h1>
          <p className="text-sm text-muted-foreground">
            {isStaff
              ? "Un singur set de echipamente: o rezervare per interval orar."
              : "Rezervările pentru clasa ta sunt evidențiate în calendar."}
          </p>
        </div>
        {canBook && (
          <Button onClick={() => openNew()}>
            <Plus className="mr-2 h-4 w-4" />
            Rezervare nouă
          </Button>
        )}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-3">
          <CardTitle className="text-base">
            {isoToDisplay(from)} – {isoToDisplay(to)}
          </CardTitle>
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, -7))}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" onClick={() => setWeekStart(startOfWeek(new Date()))}>
              Azi
            </Button>
            <Button variant="outline" size="icon" onClick={() => setWeekStart(addDays(weekStart, 7))}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="overflow-x-auto p-0">
          {isLoading ? (
            <div className="flex h-40 items-center justify-center">
              <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            </div>
          ) : (
            <table className="w-full min-w-[720px] border-collapse text-sm">
              <thead>
                <tr>
                  <th className="w-16 border-b border-r p-2 text-left text-xs font-medium text-muted-foreground">
                    Ora
                  </th>
                  {days.map((d, i) => (
                    <th key={i} className="border-b border-r p-2 text-left text-xs font-medium">
                      {WEEKDAY_LABELS[i]}
                      <span className="ml-1 text-muted-foreground">
                        {String(d.getDate()).padStart(2, "0")}.{String(d.getMonth() + 1).padStart(2, "0")}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {VR_SLOTS.map((slot) => (
                  <tr key={slot}>
                    <td className="border-b border-r p-2 align-top text-xs text-muted-foreground">
                      {slot}
                    </td>
                    {days.map((d, i) => {
                      const iso = dateToIso(d);
                      const r = byKey[`${iso}|${slot}`];
                      if (r) {
                        const mineClass = !isStaff && myClassIds.includes(r.class_id);
                        const dim = !isStaff && !mineClass;
                        return (
                          <td key={i} className="border-b border-r p-1 align-top">
                            <button
                              type="button"
                              onClick={() => setDetail(r)}
                              className={
                                mineClass
                                  ? "w-full rounded-md bg-primary p-2 text-left text-primary-foreground ring-2 ring-primary/40 transition-opacity hover:opacity-90"
                                  : dim
                                  ? "w-full rounded-md bg-muted p-2 text-left opacity-60 transition-opacity hover:opacity-80"
                                  : "w-full rounded-md bg-primary/10 p-2 text-left transition-colors hover:bg-primary/20"
                              }
                            >
                              {mineClass && (
                                <Badge variant="secondary" className="mb-1 text-[10px]">Clasa ta</Badge>
                              )}
                              <p className="truncate text-xs font-medium">{r.classes?.display_name}</p>
                              <p className={`truncate text-[11px] ${mineClass ? "opacity-90" : "text-muted-foreground"}`}>
                                {r.vr_rooms?.name}{teachers?.[r.teacher_id] ? ` · ${teachers[r.teacher_id]}` : ""}
                              </p>
                              {r.prepared_at && (
                                <Badge variant="secondary" className="mt-1 text-[10px]">
                                  Pregătit
                                </Badge>
                              )}
                            </button>
                          </td>
                        );
                      }
                      return (
                        <td key={i} className="border-b border-r p-1 align-top">
                          {canBook ? (
                            <button
                              type="button"
                              onClick={() => openNew(iso, slot)}
                              className="w-full rounded-md border border-dashed p-2 text-left text-[11px] text-muted-foreground transition-colors hover:border-primary/50 hover:text-foreground"
                            >
                              Liber
                            </button>
                          ) : (
                            <span className="block p-2 text-[11px] text-muted-foreground">Liber</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </CardContent>
      </Card>

      {canBook && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Rezervările mele</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {(mine ?? []).length === 0 ? (
              <p className="text-sm text-muted-foreground">Nu ai rezervări viitoare.</p>
            ) : (
              (mine ?? []).map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {isoToDisplay(r.date)} · {hhmm(r.start_time)} · {r.vr_rooms?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.classes?.display_name}
                      {r.prepared_at ? " · echipament pregătit" : ""}
                    </p>
                  </div>
                  <div className="flex gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDetail(r)}>
                      Detalii
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}

      {!isStaff && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Echipamente de pregătit pentru clasa ta</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            {volunteerList.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nu există rezervări viitoare.</p>
            ) : (
              volunteerList.map((r) => (
                <div
                  key={r.id}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-md border border-primary/40 bg-primary/5 p-3"
                >
                  <div>
                    <p className="text-sm font-medium">
                      {isoToDisplay(r.date)} · {hhmm(r.start_time)} · {r.vr_rooms?.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {r.classes?.display_name} · {teachers?.[r.teacher_id] ?? ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={() => setDetail(r)}>
                      Detalii
                    </Button>
                    <Button
                      size="sm"
                      variant={r.prepared_at ? "secondary" : "default"}
                      onClick={() => togglePrepared(r)}
                    >
                      <CheckCircle2 className="mr-2 h-4 w-4" />
                      {r.prepared_at ? "Pregătit" : "Marchează pregătit"}
                    </Button>
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>
      )}



      <VrReservationDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        initialDate={prefill.date}
        initialTime={prefill.time}
        reservation={editing}
      />

      <ReservationDetailDialog
        detail={detail}
        setDetail={setDetail}
        materials={materialsQuery.data ?? []}
        teacherName={detail ? teachers?.[detail.teacher_id] : undefined}
        canManage={!!detail && (isAdmin || detail.teacher_id === user?.id)}
        onEdit={(r) => {
          setEditing({
            id: r.id,
            date: r.date,
            start_time: r.start_time,
            class_id: r.class_id,
            room_id: r.room_id,
            notes: r.notes,
          });
          setDetail(null);
          setDialogOpen(true);
        }}
        onCancel={cancelReservation}
      />
    </div>
  );
}

function ReservationDetailDialog({
  detail,
  setDetail,
  materials,
  teacherName,
  canManage,
  onEdit,
  onCancel,
}: {
  detail: Reservation | null;
  setDetail: (r: Reservation | null) => void;
  materials: { id: string; name: string; subject: string; preview_url: string | null }[];
  teacherName?: string;
  canManage: boolean;
  onEdit: (r: Reservation) => void;
  onCancel: (r: Reservation) => void;
}) {
  return (
    <Dialog open={!!detail} onOpenChange={(v) => !v && setDetail(null)}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        {detail && (
          <>
            <DialogHeader>
              <DialogTitle>
                {isoToDisplay(detail.date)} · {hhmm(detail.start_time)} · {detail.vr_rooms?.name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-3 text-sm">
              <p>
                <span className="text-muted-foreground">Clasa:</span> {detail.classes?.display_name}
              </p>
              <p>
                <span className="text-muted-foreground">Profesor:</span> {teacherName ?? "—"}
              </p>
              {detail.notes && (
                <p>
                  <span className="text-muted-foreground">Observații:</span> {detail.notes}
                </p>
              )}
              <p>
                <span className="text-muted-foreground">Echipament:</span>{" "}
                {detail.prepared_at ? "pregătit" : "nepregătit"}
              </p>
              <div>
                <p className="mb-2 text-muted-foreground">Materiale ({materials.length})</p>
                {materials.length === 0 ? (
                  <p className="text-muted-foreground">Niciun material selectat.</p>
                ) : (
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                    {materials.map((m) => (
                      <div key={m.id} className="overflow-hidden rounded-md border">
                        <div className="aspect-video bg-muted">
                          {m.preview_url && (
                            <img
                              src={m.preview_url}
                              alt={m.name}
                              loading="lazy"
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <p className="line-clamp-2 p-2 text-xs">{m.name}</p>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
            {canManage && (
              <div className="flex justify-end gap-2 pt-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(detail)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Modifică
                </Button>
                <Button variant="destructive" size="sm" onClick={() => onCancel(detail)}>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Anulează rezervarea
                </Button>
              </div>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
