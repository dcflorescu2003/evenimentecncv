import { useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { ArrowLeftRight, Pencil, ShieldCheck } from "lucide-react";
import {
  WEEKDAY_LABELS, addDays, bucharestToday, displayMonday, formatDdMm, swapAnchor, weekSlotFor,
  type DutyShift, type WeekSlot,
} from "@/lib/duty-schedule";

interface Teacher { id: string; first_name: string; last_name: string }
interface Row { week_slot: WeekSlot; weekday: number; shift: DutyShift; position: number; teacher_id: string | null }

const name = (t?: Teacher) => (t ? `${t.last_name} ${t.first_name}` : "—");
const key = (s: string, d: number, sh: string, p: number) => `${s}|${d}|${sh}|${p}`;

export default function DutyScheduleSection() {
  const { user, hasModuleAccess } = useAuth();
  const canEdit = hasModuleAccess("duty_editor");
  const qc = useQueryClient();
  const [editing, setEditing] = useState(false);

  const { data: settings } = useQuery({
    queryKey: ["duty_settings"],
    queryFn: async () => {
      const { data, error } = await supabase.from("duty_settings").select("anchor_monday").maybeSingle();
      if (error) throw error;
      return data;
    },
  });
  const { data: rows = [] } = useQuery({
    queryKey: ["duty_schedule"],
    queryFn: async () => {
      const { data, error } = await supabase.from("duty_schedule").select("week_slot, weekday, shift, position, teacher_id");
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });
  const { data: teachers = [] } = useQuery({
    queryKey: ["duty_teachers"],
    queryFn: async () => {
      const { data: r, error } = await supabase.from("user_roles").select("user_id").in("role", ["teacher", "homeroom_teacher"]);
      if (error) throw error;
      const ids = [...new Set((r ?? []).map((x) => x.user_id))];
      const out: Teacher[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const { data, error: e } = await supabase.from("profiles").select("id, first_name, last_name").in("id", ids.slice(i, i + 200));
        if (e) throw e;
        out.push(...(data ?? []));
      }
      return out.sort((a, b) => a.last_name.localeCompare(b.last_name, "ro") || a.first_name.localeCompare(b.first_name, "ro"));
    },
  });
  const byId = useMemo(() => new Map(teachers.map((t) => [t.id, t])), [teachers]);
  const map = useMemo(() => new Map(rows.map((r) => [key(r.week_slot, r.weekday, r.shift, r.position), r.teacher_id])), [rows]);

  const anchor = settings?.anchor_monday ?? "2026-11-09";
  const today = bucharestToday();
  const monday = displayMonday(today);
  const weeks = [monday, addDays(monday, 7)];

  const swap = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("duty_settings").update({ anchor_monday: swapAnchor(anchor), updated_at: new Date().toISOString() }).eq("id", true);
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["duty_settings"] }); toast.success("Ciclul A/B a fost inversat"); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Card>
      <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-2 space-y-0">
        <CardTitle className="flex items-center gap-2 text-lg"><ShieldCheck className="h-5 w-5 text-primary" /> Profesori de serviciu</CardTitle>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={() => { if (confirm("Inversezi săptămânile A și B?")) swap.mutate(); }} disabled={swap.isPending}>
              <ArrowLeftRight className="mr-1 h-4 w-4" /> Schimbă A-B
            </Button>
            <Button size="sm" onClick={() => setEditing(true)}><Pencil className="mr-1 h-4 w-4" /> Editează</Button>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-6">
        {weeks.map((wm, wi) => {
          const slot = weekSlotFor(wm, anchor);
          return (
            <div key={wm}>
              <div className="mb-2 flex items-center gap-2 text-sm font-medium">
                {wi === 0 ? "Săptămâna curentă" : "Săptămâna următoare"}
                <span className="text-muted-foreground">{formatDdMm(wm)} – {formatDdMm(addDays(wm, 4))}</span>
                <Badge variant="secondary">Săpt. {slot}</Badge>
              </div>
              <div className="overflow-x-auto rounded-md border">
                <table className="w-full text-sm">
                  <thead className="bg-muted/50">
                    <tr><th className="p-2 text-left">Data</th><th className="p-2 text-left">Dimineața</th><th className="p-2 text-left">După-amiaza</th></tr>
                  </thead>
                  <tbody>
                    {WEEKDAY_LABELS.map((lbl, i) => {
                      const date = addDays(wm, i);
                      const isToday = date === today;
                      return (
                        <tr key={lbl} className={`border-t ${isToday ? "bg-primary/5" : ""}`}>
                          <td className="p-2 font-medium whitespace-nowrap">{lbl} <span className="text-muted-foreground">{formatDdMm(date)}</span></td>
                          {(["morning", "afternoon"] as DutyShift[]).map((sh) => (
                            <td key={sh} className="p-2">
                              {[1, 2].map((p) => {
                                const tid = map.get(key(slot, i + 1, sh, p));
                                const mine = tid && tid === user?.id;
                                return <div key={p} className={mine ? "font-semibold text-primary" : ""}>{name(tid ? byId.get(tid) : undefined)}</div>;
                              })}
                            </td>
                          ))}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          );
        })}
      </CardContent>
      {editing && <DutyEditor teachers={teachers} byId={byId} map={map} onClose={() => setEditing(false)} />}
    </Card>
  );
}

function DutyEditor({ teachers, byId, map, onClose }: { teachers: Teacher[]; byId: Map<string, Teacher>; map: Map<string, string | null>; onClose: () => void }) {
  const qc = useQueryClient();
  const [draft, setDraft] = useState<Map<string, string | null>>(() => new Map(map));
  const save = useMutation({
    mutationFn: async () => {
      const payload: Row[] = [];
      for (const s of ["A", "B"] as WeekSlot[]) for (let d = 1; d <= 5; d++) for (const sh of ["morning", "afternoon"] as DutyShift[]) for (const p of [1, 2])
        payload.push({ week_slot: s, weekday: d, shift: sh, position: p, teacher_id: draft.get(key(s, d, sh, p)) ?? null });
      const { error } = await supabase.from("duty_schedule").upsert(payload.map((r) => ({ ...r, updated_at: new Date().toISOString() })), { onConflict: "week_slot,weekday,shift,position" });
      if (error) throw error;
    },
    onSuccess: () => { qc.invalidateQueries({ queryKey: ["duty_schedule"] }); toast.success("Profesorii de serviciu au fost salvați"); onClose(); },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <Dialog open onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader><DialogTitle>Editează profesorii de serviciu</DialogTitle></DialogHeader>
        <Tabs defaultValue="A">
          <TabsList><TabsTrigger value="A">Săptămâna A</TabsTrigger><TabsTrigger value="B">Săptămâna B</TabsTrigger></TabsList>
          {(["A", "B"] as WeekSlot[]).map((s) => (
            <TabsContent key={s} value={s}>
              <div className="space-y-3">
                {WEEKDAY_LABELS.map((lbl, i) => (
                  <div key={lbl} className="rounded-md border p-3">
                    <div className="mb-2 font-medium">{lbl}</div>
                    <div className="grid gap-3 sm:grid-cols-2">
                      {(["morning", "afternoon"] as DutyShift[]).map((sh) => (
                        <div key={sh} className="space-y-1">
                          <div className="text-xs text-muted-foreground">{sh === "morning" ? "Dimineața" : "După-amiaza"}</div>
                          {[1, 2].map((p) => {
                            const k = key(s, i + 1, sh, p);
                            return (
                              <TeacherPicker key={p} teachers={teachers} value={draft.get(k) ?? null} label={name(byId.get(draft.get(k) ?? ""))}
                                onChange={(v) => setDraft((m) => new Map(m).set(k, v))} />
                            );
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </TabsContent>
          ))}
        </Tabs>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Anulează</Button>
          <Button onClick={() => save.mutate()} disabled={save.isPending}>{save.isPending ? "Se salvează…" : "Salvează"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function TeacherPicker({ teachers, value, label, onChange }: { teachers: Teacher[]; value: string | null; label: string; onChange: (v: string | null) => void }) {
  const [open, setOpen] = useState(false);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="outline" size="sm" className="w-full justify-start font-normal">{value ? label : <span className="text-muted-foreground">Alege profesor…</span>}</Button>
      </PopoverTrigger>
      <PopoverContent className="w-72 p-0" align="start">
        <Command>
          <CommandInput placeholder="Caută profesor…" />
          <CommandList>
            <CommandEmpty>Niciun rezultat</CommandEmpty>
            <CommandGroup>
              {value && <CommandItem value="__none" onSelect={() => { onChange(null); setOpen(false); }}>— Golește —</CommandItem>}
              {teachers.map((t) => (
                <CommandItem key={t.id} value={`${t.last_name} ${t.first_name} ${t.id}`} onSelect={() => { onChange(t.id); setOpen(false); }}>
                  {t.last_name} {t.first_name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
