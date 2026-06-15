import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DateInput } from "@/components/ui/date-input";
import {
  INVOLVEMENT_TYPES, involvementTypeLabel,
  involvementStatusColor, involvementStatusLabel,
} from "@/lib/portfolioInvolvement";

interface Row {
  id: string;
  type: string;
  description: string;
  hours: number | null;
  occurred_on: string | null;
  status: string;
  teacher_note: string | null;
  teacher_id: string;
  teacher: { first_name: string; last_name: string } | null;
}

export default function StudentInvolvementTab() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [teacherId, setTeacherId] = useState("");
  const [type, setType] = useState("voluntariat");
  const [desc, setDesc] = useState("");
  const [hours, setHours] = useState("");
  const [date, setDate] = useState("");

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["student_involvement", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_involvement")
        .select("id, type, description, hours, occurred_on, status, teacher_note, teacher_id")
        .eq("student_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as any[];
      if (list.length === 0) return [];
      const ids = Array.from(new Set(list.map((r) => r.teacher_id)));
      const { data: profs } = await supabase
        .from("profiles").select("id, first_name, last_name").in("id", ids);
      const m = new Map((profs ?? []).map((p: any) => [p.id, p]));
      return list.map((r) => ({ ...r, teacher: m.get(r.teacher_id) ?? null })) as Row[];
    },
  });

  // Teachers with portfolio access that have student's class assigned
  const { data: teachers = [] } = useQuery({
    queryKey: ["student_portfolio_teachers", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: cls } = await supabase
        .from("student_class_assignments").select("class_id").eq("student_id", user!.id);
      const classIds = (cls ?? []).map((c) => c.class_id);
      if (classIds.length === 0) return [];
      const { data: links } = await supabase
        .from("portfolio_teacher_classes").select("teacher_id").in("class_id", classIds);
      const ids = Array.from(new Set((links ?? []).map((l) => l.teacher_id)));
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles").select("id, first_name, last_name").in("id", ids)
        .order("last_name").order("first_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!teacherId) throw new Error("Selectează profesorul");
      if (!desc.trim()) throw new Error("Adaugă o descriere");
      const { error } = await supabase.from("portfolio_involvement").insert({
        student_id: user!.id,
        teacher_id: teacherId,
        type,
        description: desc.trim(),
        hours: hours ? Number(hours) : null,
        occurred_on: date || null,
        status: "pending",
        created_by: user!.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student_involvement"] });
      setOpen(false);
      setTeacherId(""); setType("voluntariat"); setDesc(""); setHours(""); setDate("");
      toast.success("Declarație trimisă, așteaptă validarea profesorului.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portfolio_involvement").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student_involvement"] });
      toast.success("Șters");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          Declară activitățile la care ai participat. Profesorul le validează.
        </p>
        <Button size="sm" onClick={() => setOpen(true)} disabled={teachers.length === 0}>
          <Plus className="h-4 w-4 mr-1" /> Declară
        </Button>
      </div>

      {teachers.length === 0 && (
        <Card>
          <CardContent className="p-4 text-sm text-muted-foreground text-center">
            Niciun profesor cu modulul Portofoliu activ pentru clasa ta.
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      ) : rows.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nicio declarație încă.
          </CardContent>
        </Card>
      ) : (
        rows.map((r) => (
          <Card key={r.id}>
            <CardContent className="p-3 space-y-1">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <div className="font-medium text-sm">{involvementTypeLabel(r.type)}</div>
                  <div className="text-xs text-muted-foreground flex flex-wrap gap-x-2">
                    {r.teacher && <span>{r.teacher.last_name} {r.teacher.first_name}</span>}
                    {r.hours != null && <span>· {r.hours}h</span>}
                    {r.occurred_on && (
                      <span>· {new Date(r.occurred_on).toLocaleDateString("ro-RO")}</span>
                    )}
                    <span className={`· ${involvementStatusColor(r.status)}`}>
                      · {involvementStatusLabel(r.status)}
                    </span>
                  </div>
                </div>
                {r.status === "pending" && (
                  <Button size="icon" variant="ghost" onClick={() => deleteMutation.mutate(r.id)}>
                    <Trash2 className="h-4 w-4 text-destructive" />
                  </Button>
                )}
              </div>
              <p className="text-sm whitespace-pre-wrap">{r.description}</p>
              {r.teacher_note && (
                <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2">
                  <strong>Răspuns profesor: </strong>{r.teacher_note}
                </p>
              )}
            </CardContent>
          </Card>
        ))
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Declară implicare</DialogTitle>
            <DialogDescription>
              Trimite o declarație pentru validare. Profesorul poate ajusta orele sau respinge.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Profesor</Label>
              <Select value={teacherId} onValueChange={setTeacherId}>
                <SelectTrigger><SelectValue placeholder="Selectează…" /></SelectTrigger>
                <SelectContent>
                  {teachers.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.last_name} {t.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tip</Label>
              <Select value={type} onValueChange={setType}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {INVOLVEMENT_TYPES.map((t) => (
                    <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Descriere</Label>
              <Textarea rows={3} value={desc} onChange={(e) => setDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ore (opțional)</Label>
                <Input type="number" min={0} step={0.5}
                  value={hours} onChange={(e) => setHours(e.target.value)} />
              </div>
              <div>
                <Label>Data (opțional)</Label>
                <DateInput value={date} onChange={setDate} />
              </div>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
            <Button disabled={submitMutation.isPending} onClick={() => submitMutation.mutate()}>
              {submitMutation.isPending ? "Se trimite…" : "Trimite"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
