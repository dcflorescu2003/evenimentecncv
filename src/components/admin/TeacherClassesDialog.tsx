import { useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

/** Admin: setează clasele la care predă un profesor (aceeași asociere ca în Portofoliu). */
export function TeacherClassesDialog({ teacherId, teacherName, onClose }: {
  teacherId: string | null; teacherName?: string; onClose: () => void;
}) {
  const qc = useQueryClient();
  const [selected, setSelected] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  const { data: classes = [] } = useQuery({
    queryKey: ["active_classes_full"],
    queryFn: async () => {
      const { data, error } = await supabase.from("classes")
        .select("id, display_name, grade_number, section, academic_year").eq("is_active", true)
        .order("grade_number").order("section");
      if (error) throw error;
      return data;
    },
    enabled: !!teacherId,
  });

  const { data: current, isLoading } = useQuery({
    queryKey: ["teacher_classes_admin", teacherId],
    queryFn: async () => {
      const { data, error } = await supabase.from("portfolio_teacher_classes").select("class_id").eq("teacher_id", teacherId!);
      if (error) throw error;
      return [...new Set((data ?? []).map((r: any) => r.class_id as string))];
    },
    enabled: !!teacherId,
  });

  useEffect(() => { if (current) setSelected(current); }, [current]);

  async function save() {
    if (!teacherId || !current) return;
    setSaving(true);
    const toRemove = current.filter((id) => !selected.includes(id));
    const toAdd = selected.filter((id) => !current.includes(id));
    if (toRemove.length) {
      const { error } = await supabase.from("portfolio_teacher_classes").delete().eq("teacher_id", teacherId).in("class_id", toRemove);
      if (error) { setSaving(false); toast.error(error.message); return; }
    }
    if (toAdd.length) {
      const rows = toAdd.map((cid) => ({
        teacher_id: teacherId, class_id: cid,
        academic_year: (classes.find((c) => c.id === cid) as any)?.academic_year ?? null,
      }));
      const { error } = await supabase.from("portfolio_teacher_classes").insert(rows as any);
      if (error) { setSaving(false); toast.error(error.message); return; }
    }
    setSaving(false);
    toast.success("Clase salvate");
    qc.invalidateQueries({ queryKey: ["teacher_classes_admin", teacherId] });
    onClose();
  }

  const byGrade = classes.reduce((acc: Record<number, any[]>, c) => {
    (acc[c.grade_number] ||= []).push(c); return acc;
  }, {});

  return (
    <Dialog open={!!teacherId} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Clase la care predă</DialogTitle>
          <DialogDescription>{teacherName}</DialogDescription>
        </DialogHeader>
        {isLoading ? <p className="text-sm text-muted-foreground">Se încarcă…</p> : (
          <div className="max-h-80 space-y-2 overflow-y-auto rounded-md border p-3">
            {Object.entries(byGrade).sort(([a], [b]) => Number(a) - Number(b)).map(([g, list]) => (
              <div key={g}>
                <p className="text-sm font-medium">Clasa {g}</p>
                <div className="ml-4 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {list.map((c) => (
                    <label key={c.id} className="flex cursor-pointer items-center gap-1 text-sm">
                      <Checkbox
                        checked={selected.includes(c.id)}
                        onCheckedChange={(v) => setSelected((s) => v ? [...s, c.id] : s.filter((x) => x !== c.id))}
                      />
                      {c.display_name}
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
        <p className="text-xs text-muted-foreground">La promovarea claselor, asocierile se mută automat la noua clasă.</p>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Anulează</Button>
          <Button onClick={save} disabled={saving || isLoading}>{saving ? "Se salvează…" : "Salvează"}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
