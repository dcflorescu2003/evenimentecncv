import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Plus, Trash2, ChevronRight } from "lucide-react";
import { toast } from "sonner";

interface Cls {
  id: string;
  display_name: string;
  academic_year: string;
  grade_number: number;
  section: string;
}

interface Assignment {
  id: string;
  class_id: string;
  academic_year: string;
  classes: Cls | null;
}

export default function PortfolioClassesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [addOpen, setAddOpen] = useState(false);
  const [selectedClassId, setSelectedClassId] = useState<string>("");

  const { data: assignments = [], isLoading } = useQuery({
    queryKey: ["portfolio_my_classes", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_teacher_classes")
        .select("id, class_id, academic_year, classes(id, display_name, academic_year, grade_number, section)")
        .eq("teacher_id", user!.id)
        .order("academic_year", { ascending: false });
      if (error) throw error;
      return (data ?? []) as unknown as Assignment[];
    },
  });

  const { data: allClasses = [] } = useQuery({
    queryKey: ["all_active_classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, display_name, academic_year, grade_number, section")
        .eq("is_active", true)
        .order("academic_year", { ascending: false })
        .order("grade_number")
        .order("section");
      if (error) throw error;
      return (data ?? []) as Cls[];
    },
  });

  const assignedIds = new Set(assignments.map((a) => a.class_id));
  const availableClasses = allClasses.filter((c) => !assignedIds.has(c.id));

  const addMutation = useMutation({
    mutationFn: async (classId: string) => {
      const cls = allClasses.find((c) => c.id === classId);
      if (!cls) throw new Error("Clasa nu există");
      const { error } = await supabase.from("portfolio_teacher_classes").insert({
        teacher_id: user!.id,
        class_id: cls.id,
        academic_year: cls.academic_year,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_my_classes"] });
      qc.invalidateQueries({ queryKey: ["portfolio_dashboard_classes"] });
      setAddOpen(false);
      setSelectedClassId("");
      toast.success("Clasă adăugată");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portfolio_teacher_classes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_my_classes"] });
      qc.invalidateQueries({ queryKey: ["portfolio_dashboard_classes"] });
      toast.success("Clasă eliminată");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Clase și elevi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Adaugă clasele pentru care ții portofoliu. Le poți schimba oricând.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)} disabled={availableClasses.length === 0}>
          <Plus className="mr-2 h-4 w-4" /> Adaugă clasă
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      ) : assignments.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nu ai nicio clasă asignată. Adaugă una pentru a începe.
          </CardContent>
        </Card>
      ) : (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {assignments.map((a) => (
            <Card key={a.id} className="group">
              <CardContent className="flex items-center justify-between gap-2 p-4">
                <button
                  className="min-w-0 flex-1 text-left"
                  onClick={() => navigate(`/portfolio/classes/${a.class_id}`)}
                >
                  <div className="font-semibold truncate">
                    {a.classes?.display_name ?? "Clasă"}
                  </div>
                  <div className="text-xs text-muted-foreground mt-0.5">
                    An școlar {a.academic_year}
                  </div>
                </button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Elimină"
                  onClick={() => removeMutation.mutate(a.id)}
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  title="Deschide"
                  onClick={() => navigate(`/portfolio/classes/${a.class_id}`)}
                >
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adaugă clasă</DialogTitle>
            <DialogDescription>
              Selectează clasa pentru care vrei să ții portofoliu.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label>Clasă</Label>
            <Select value={selectedClassId} onValueChange={setSelectedClassId}>
              <SelectTrigger>
                <SelectValue placeholder="Selectează clasa…" />
              </SelectTrigger>
              <SelectContent>
                {availableClasses.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.display_name} · {c.academic_year}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Anulează</Button>
            <Button
              disabled={!selectedClassId || addMutation.isPending}
              onClick={() => addMutation.mutate(selectedClassId)}
            >
              {addMutation.isPending ? "Se adaugă…" : "Adaugă"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
