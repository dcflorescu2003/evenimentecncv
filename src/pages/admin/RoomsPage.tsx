import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Plus, Pencil, Trash2, Search, Power } from "lucide-react";
import { toast } from "sonner";

type Room = { id: string; name: string; sort_order: number; is_active: boolean };

export default function RoomsPage() {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Room | null>(null);
  const [name, setName] = useState("");
  const [deleteRoom, setDeleteRoom] = useState<Room | null>(null);

  const { data: rooms = [], isLoading } = useQuery({
    queryKey: ["admin-rooms"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vr_rooms").select("id, name, sort_order, is_active");
      if (error) throw error;
      return (data ?? []) as Room[];
    },
  });

  const filtered = rooms
    .filter((r) => !search || r.name.toLowerCase().includes(search.toLowerCase()))
    .sort((a, b) => a.name.localeCompare(b.name, "ro", { numeric: true }));

  const refresh = () => qc.invalidateQueries({ queryKey: ["admin-rooms"] });

  const save = useMutation({
    mutationFn: async () => {
      const n = name.trim();
      if (!n) throw new Error("Numele este obligatoriu");
      if (rooms.some((r) => r.id !== editing?.id && r.name.toLowerCase() === n.toLowerCase()))
        throw new Error("Există deja o sală cu acest nume");
      if (editing) {
        const { error } = await supabase.from("vr_rooms").update({ name: n }).eq("id", editing.id);
        if (error) throw error;
        await supabase.from("events").update({ location: n }).eq("room_id", editing.id);
      } else {
        const max = rooms.reduce((m, r) => Math.max(m, r.sort_order ?? 0), 0);
        const { error } = await supabase.from("vr_rooms").insert({ name: n, sort_order: max + 1, is_active: true });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      refresh();
      toast.success(editing ? "Sală actualizată" : "Sală adăugată");
      setOpen(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const toggle = useMutation({
    mutationFn: async (r: Room) => {
      const { error } = await supabase.from("vr_rooms").update({ is_active: !r.is_active }).eq("id", r.id);
      if (error) throw error;
    },
    onSuccess: () => { refresh(); toast.success("Status actualizat"); },
    onError: (e: Error) => toast.error(e.message),
  });

  const remove = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("vr_rooms").delete().eq("id", id);
      if (error) {
        if (error.code === "23503") throw new Error("Sala are rezervări Smart Lab. Dezactiveaz-o în loc să o ștergi.");
        throw error;
      }
    },
    onSuccess: () => { refresh(); setDeleteRoom(null); toast.success("Sală ștearsă"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Săli</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Sălile din liceu disponibile pentru evenimente și Smart Lab.
          </p>
        </div>
        <Button onClick={() => { setEditing(null); setName(""); setOpen(true); }} className="w-full sm:w-auto">
          <Plus className="mr-2 h-4 w-4" /> Sală nouă
        </Button>
      </div>

      <div className="relative w-full sm:max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input placeholder="Caută sală…" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
      </div>

      <div className="rounded-lg border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>Denumire</TableHead>
              <TableHead>Status</TableHead>
              <TableHead className="w-32">Acțiuni</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {isLoading ? (
              <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Se încarcă…</TableCell></TableRow>
            ) : filtered.length === 0 ? (
              <TableRow><TableCell colSpan={3} className="py-8 text-center text-muted-foreground">Nicio sală</TableCell></TableRow>
            ) : filtered.map((r) => (
              <TableRow key={r.id}>
                <TableCell className="font-medium">{r.name}</TableCell>
                <TableCell>
                  <Badge variant={r.is_active ? "default" : "destructive"}>{r.is_active ? "Activă" : "Inactivă"}</Badge>
                </TableCell>
                <TableCell>
                  <div className="flex gap-1">
                    <Button variant="ghost" size="icon" title="Editează" onClick={() => { setEditing(r); setName(r.name); setOpen(true); }}>
                      <Pencil className="h-4 w-4" />
                    </Button>
                    <Button variant="ghost" size="icon" title={r.is_active ? "Dezactivează" : "Activează"} onClick={() => toggle.mutate(r)}>
                      <Power className={`h-4 w-4 ${r.is_active ? "text-primary" : "text-muted-foreground"}`} />
                    </Button>
                    <Button variant="ghost" size="icon" title="Șterge" onClick={() => setDeleteRoom(r)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>{editing ? "Editează sala" : "Sală nouă"}</DialogTitle></DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="room-name">Denumire</Label>
            <Input id="room-name" value={name} onChange={(e) => setName(e.target.value)} placeholder="ex. Info1"
              onKeyDown={(e) => { if (e.key === "Enter") save.mutate(); }} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button onClick={() => save.mutate()} disabled={save.isPending}>Salvează</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteRoom} onOpenChange={(o) => !o && setDeleteRoom(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Ștergi sala „{deleteRoom?.name}"?</AlertDialogTitle>
            <AlertDialogDescription>
              Evenimentele programate în această sală își păstrează numele locației, dar sala nu mai este blocată pentru ele.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteRoom && remove.mutate(deleteRoom.id)}>Șterge</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
