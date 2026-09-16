import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useToast } from "@/hooks/use-toast";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { DateInput } from "@/components/ui/date-input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { VR_SLOTS, todayIso } from "@/lib/smartlab";
import { VrMaterialPicker, type VrMaterial } from "./VrMaterialPicker";
import { Loader2 } from "lucide-react";

export interface VrReservationEdit {
  id: string;
  date: string;
  start_time: string;
  class_id: string;
  room_id: string;
  notes: string | null;
}

export function VrReservationDialog({
  open,
  onOpenChange,
  initialDate,
  initialTime,
  reservation,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  initialDate?: string;
  initialTime?: string;
  reservation?: VrReservationEdit | null;
}) {
  const { user } = useAuth();
  const { toast } = useToast();
  const qc = useQueryClient();

  const [date, setDate] = useState(initialDate ?? todayIso());
  const [startTime, setStartTime] = useState(initialTime ?? VR_SLOTS[0]);
  const [classId, setClassId] = useState("");
  const [roomId, setRoomId] = useState("");
  const [notes, setNotes] = useState("");
  const [materials, setMaterials] = useState<VrMaterial[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: classes } = useQuery({
    queryKey: ["vr-classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, display_name, grade_number, section")
        .eq("is_active", true)
        .order("grade_number")
        .order("section");
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: rooms } = useQuery({
    queryKey: ["vr-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vr_rooms")
        .select("id, name")
        .eq("is_active", true)
        .order("sort_order");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!open) return;
    if (reservation) {
      setDate(reservation.date);
      setStartTime(reservation.start_time.slice(0, 5));
      setClassId(reservation.class_id);
      setRoomId(reservation.room_id);
      setNotes(reservation.notes ?? "");
      void (async () => {
        const { data } = await supabase
          .from("vr_reservation_materials")
          .select("vr_materials(id, subject, name, media_type, size_label, preview_url)")
          .eq("reservation_id", reservation.id);
        setMaterials(
          ((data ?? []) as { vr_materials: VrMaterial | null }[])
            .map((r) => r.vr_materials)
            .filter(Boolean) as VrMaterial[],
        );
      })();
    } else {
      setDate(initialDate ?? todayIso());
      setStartTime(initialTime ?? VR_SLOTS[0]);
      setClassId("");
      setRoomId("");
      setNotes("");
      setMaterials([]);
    }
  }, [open, reservation, initialDate, initialTime]);

  async function handleSave() {
    if (!user) return;
    if (!classId || !roomId || !date || !startTime) {
      toast({ title: "Completează data, ora, clasa și sala.", variant: "destructive" });
      return;
    }
    setSaving(true);
    try {
      let reservationId = reservation?.id;

      if (reservation) {
        const { error } = await supabase
          .from("vr_reservations")
          .update({
            date,
            start_time: `${startTime}:00`,
            class_id: classId,
            room_id: roomId,
            notes: notes || null,
          })
          .eq("id", reservation.id);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("vr_reservations")
          .insert({
            date,
            start_time: `${startTime}:00`,
            class_id: classId,
            room_id: roomId,
            notes: notes || null,
            teacher_id: user.id,
          })
          .select("id")
          .single();
        if (error) throw error;
        reservationId = data.id;
      }

      if (reservationId) {
        await supabase.from("vr_reservation_materials").delete().eq("reservation_id", reservationId);
        if (materials.length > 0) {
          const { error: mErr } = await supabase.from("vr_reservation_materials").insert(
            materials.map((m) => ({ reservation_id: reservationId!, material_id: m.id })),
          );
          if (mErr) throw mErr;
        }

        await supabase.functions.invoke("notify-vr-reservation", {
          body: { reservation_id: reservationId, action: reservation ? "updated" : "created" },
        });
      }

      await qc.invalidateQueries({ queryKey: ["vr-reservations"] });
      toast({ title: reservation ? "Rezervare actualizată." : "Rezervare creată." });
      onOpenChange(false);
    } catch (e) {
      const msg = (e as { message?: string })?.message ?? "";
      toast({
        title: msg.includes("vr_reservations_slot_unique")
          ? "Intervalul este deja rezervat de altcineva."
          : "Nu am putut salva rezervarea.",
        description: msg.includes("vr_reservations_slot_unique") ? undefined : msg,
        variant: "destructive",
      });
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>{reservation ? "Modifică rezervarea" : "Rezervare echipament VR"}</DialogTitle>
          <DialogDescription>
            Într-un interval orar poate exista o singură rezervare la nivel de școală.
          </DialogDescription>
        </DialogHeader>

        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-1.5">
            <Label>Data</Label>
            <DateInput value={date} onChange={setDate} />
          </div>
          <div className="space-y-1.5">
            <Label>Ora</Label>
            <Select value={startTime} onValueChange={setStartTime}>
              <SelectTrigger>
                <SelectValue placeholder="Alege ora" />
              </SelectTrigger>
              <SelectContent className="z-50 bg-popover">
                {VR_SLOTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {s}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Clasa</Label>
            <Select value={classId} onValueChange={setClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Alege clasa" />
              </SelectTrigger>
              <SelectContent className="z-50 max-h-64 bg-popover">
                {(classes ?? []).map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.display_name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Sala</Label>
            <Select value={roomId} onValueChange={setRoomId}>
              <SelectTrigger>
                <SelectValue placeholder="Alege sala" />
              </SelectTrigger>
              <SelectContent className="z-50 max-h-64 bg-popover">
                {(rooms ?? []).map((r) => (
                  <SelectItem key={r.id} value={r.id}>
                    {r.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        </div>

        <div className="space-y-1.5">
          <Label>Materiale VR ({materials.length} selectate)</Label>
          <VrMaterialPicker selected={materials} onChange={setMaterials} />
        </div>

        <div className="space-y-1.5">
          <Label>Observații (opțional)</Label>
          <Textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} />
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={saving}>
            Renunță
          </Button>
          <Button onClick={handleSave} disabled={saving}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {reservation ? "Salvează" : "Rezervă"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
