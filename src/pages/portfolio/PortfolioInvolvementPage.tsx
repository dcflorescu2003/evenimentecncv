import { useState, useMemo } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Check, X, Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { DateInput } from "@/components/ui/date-input";
import {
  INVOLVEMENT_TYPES, involvementTypeLabel,
  involvementStatusColor, involvementStatusLabel,
} from "@/lib/portfolioInvolvement";

interface Row {
  id: string;
  student_id: string;
  type: string;
  description: string;
  hours: number | null;
  occurred_on: string | null;
  status: string;
  teacher_note: string | null;
  attach_to_portfolio: boolean;
  created_at: string;
  student: { first_name: string; last_name: string } | null;
}

export default function PortfolioInvolvementPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [tab, setTab] = useState<"pending" | "approved" | "rejected">("pending");
  const [reviewing, setReviewing] = useState<Row | null>(null);
  const [feedback, setFeedback] = useState("");
  const [editHours, setEditHours] = useState<string>("");
  const [attach, setAttach] = useState(false);

  // New entry by teacher
  const [addOpen, setAddOpen] = useState(false);
  const [newStudentId, setNewStudentId] = useState<string>("");
  const [newType, setNewType] = useState<string>("voluntariat");
  const [newDesc, setNewDesc] = useState("");
  const [newHours, setNewHours] = useState("");
  const [newDate, setNewDate] = useState("");
  const [newAttach, setNewAttach] = useState(true);

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["portfolio_involvement_teacher", user?.id, tab],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_involvement")
        .select("id, student_id, type, description, hours, occurred_on, status, teacher_note, attach_to_portfolio, created_at")
        .eq("teacher_id", user!.id)
        .eq("status", tab)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as any[];
      if (list.length === 0) return [];
      const ids = Array.from(new Set(list.map((r) => r.student_id)));
      const { data: students } = await supabase
        .from("profiles").select("id, first_name, last_name").in("id", ids);
      const m = new Map((students ?? []).map((s: any) => [s.id, s]));
      return list.map((r) => ({ ...r, student: m.get(r.student_id) ?? null })) as Row[];
    },
  });

  // Students from teacher's classes (for manual add)
  const { data: myStudents = [] } = useQuery({
    queryKey: ["portfolio_my_students_list", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: cls } = await supabase
        .from("portfolio_teacher_classes").select("class_id").eq("teacher_id", user!.id);
      const classIds = (cls ?? []).map((c) => c.class_id);
      if (classIds.length === 0) return [];
      const { data: assn } = await supabase
        .from("student_class_assignments").select("student_id").in("class_id", classIds);
      const studentIds = Array.from(new Set((assn ?? []).map((a) => a.student_id)));
      if (studentIds.length === 0) return [];
      const { data: profs } = await supabase
        .from("profiles").select("id, first_name, last_name").in("id", studentIds)
        .order("last_name").order("first_name");
      return profs ?? [];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (vars: { id: string; status: "approved" | "rejected" }) => {
      const { error } = await supabase
        .from("portfolio_involvement")
        .update({
          status: vars.status,
          teacher_note: feedback.trim() || null,
          hours: editHours ? Number(editHours) : null,
          attach_to_portfolio: vars.status === "approved" ? attach : false,
          reviewed_by: user!.id,
          reviewed_at: new Date().toISOString(),
        })
        .eq("id", vars.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_involvement_teacher"] });
      qc.invalidateQueries({ queryKey: ["portfolio_dashboard_involvement_pending"] });
      setReviewing(null);
      toast.success("Salvat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addMutation = useMutation({
    mutationFn: async () => {
      if (!newStudentId) throw new Error("Selectează un elev");
      if (!newDesc.trim()) throw new Error("Adaugă o descriere");
      const { error } = await supabase.from("portfolio_involvement").insert({
        student_id: newStudentId,
        teacher_id: user!.id,
        type: newType,
        description: newDesc.trim(),
        hours: newHours ? Number(newHours) : null,
        occurred_on: newDate || null,
        status: "approved",
        attach_to_portfolio: newAttach,
        created_by: user!.id,
        reviewed_by: user!.id,
        reviewed_at: new Date().toISOString(),
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_involvement_teacher"] });
      setAddOpen(false);
      setNewStudentId(""); setNewType("voluntariat"); setNewDesc("");
      setNewHours(""); setNewDate(""); setNewAttach(true);
      toast.success("Implicare adăugată");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteMutation = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("portfolio_involvement").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_involvement_teacher"] });
      toast.success("Șters");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const openReview = (r: Row) => {
    setReviewing(r);
    setFeedback(r.teacher_note ?? "");
    setEditHours(r.hours != null ? String(r.hours) : "");
    setAttach(r.attach_to_portfolio);
  };

  const pendingCount = useMemo(() => rows.filter((r) => r.status === "pending").length, [rows]);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Implicare elevi</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Validează declarațiile elevilor sau adaugă tu implicări observate.
          </p>
        </div>
        <Button onClick={() => setAddOpen(true)}>
          <Plus className="mr-2 h-4 w-4" /> Adaugă implicare
        </Button>
      </div>

      <Tabs value={tab} onValueChange={(v) => setTab(v as any)}>
        <TabsList>
          <TabsTrigger value="pending">În așteptare{tab === "pending" && pendingCount > 0 ? ` (${pendingCount})` : ""}</TabsTrigger>
          <TabsTrigger value="approved">Aprobate</TabsTrigger>
          <TabsTrigger value="rejected">Respinse</TabsTrigger>
        </TabsList>

        <TabsContent value={tab} className="mt-4 space-y-2">
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Se încarcă…</p>
          ) : rows.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Nimic aici.
              </CardContent>
            </Card>
          ) : (
            rows.map((r) => (
              <Card key={r.id}>
                <CardContent className="p-4 space-y-2">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="font-medium">
                        {r.student ? `${r.student.last_name} ${r.student.first_name}` : "Elev"}
                      </div>
                      <div className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-x-3">
                        <span>{involvementTypeLabel(r.type)}</span>
                        {r.hours != null && <span>{r.hours}h</span>}
                        {r.occurred_on && (
                          <span>{new Date(r.occurred_on).toLocaleDateString("ro-RO")}</span>
                        )}
                        <span className={involvementStatusColor(r.status)}>
                          {involvementStatusLabel(r.status)}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-1">
                      {r.status === "pending" ? (
                        <Button size="sm" onClick={() => openReview(r)}>Verifică</Button>
                      ) : (
                        <>
                          <Button size="sm" variant="ghost" onClick={() => openReview(r)}>Editează</Button>
                          <Button
                            size="icon" variant="ghost"
                            onClick={() => deleteMutation.mutate(r.id)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{r.description}</p>
                  {r.teacher_note && (
                    <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2">
                      <strong>Notă: </strong>{r.teacher_note}
                    </p>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      {/* Review dialog */}
      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {reviewing?.student
                ? `${reviewing.student.last_name} ${reviewing.student.first_name}`
                : "Implicare"}
            </DialogTitle>
            <DialogDescription>{involvementTypeLabel(reviewing?.type ?? "")}</DialogDescription>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-3">
              <p className="text-sm whitespace-pre-wrap rounded-md border p-2 bg-muted/30">
                {reviewing.description}
              </p>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <Label>Ore</Label>
                  <Input
                    type="number" min={0} step={0.5}
                    value={editHours} onChange={(e) => setEditHours(e.target.value)}
                  />
                </div>
                {reviewing.occurred_on && (
                  <div>
                    <Label>Data</Label>
                    <Input
                      value={new Date(reviewing.occurred_on).toLocaleDateString("ro-RO")}
                      disabled
                    />
                  </div>
                )}
              </div>
              <div>
                <Label>Notă (opțională)</Label>
                <Textarea
                  rows={3} value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Observații pentru elev…"
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={attach} onCheckedChange={(c) => setAttach(c === true)} />
                Atașează automat la portofoliul elevului
              </label>
            </div>
          )}
          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              variant="outline"
              disabled={reviewMutation.isPending}
              onClick={() => reviewing && reviewMutation.mutate({ id: reviewing.id, status: "rejected" })}
            >
              <X className="h-4 w-4 mr-1" /> Respinge
            </Button>
            <Button
              disabled={reviewMutation.isPending}
              onClick={() => reviewing && reviewMutation.mutate({ id: reviewing.id, status: "approved" })}
            >
              <Check className="h-4 w-4 mr-1" /> Aprobă
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Add dialog */}
      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Adaugă implicare</DialogTitle>
            <DialogDescription>
              Înregistrează o implicare observată — va fi aprobată automat.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Elev</Label>
              <Select value={newStudentId} onValueChange={setNewStudentId}>
                <SelectTrigger><SelectValue placeholder="Selectează elev…" /></SelectTrigger>
                <SelectContent>
                  {myStudents.map((s: any) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.last_name} {s.first_name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Tip</Label>
              <Select value={newType} onValueChange={setNewType}>
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
              <Textarea rows={3} value={newDesc} onChange={(e) => setNewDesc(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Ore</Label>
                <Input
                  type="number" min={0} step={0.5}
                  value={newHours} onChange={(e) => setNewHours(e.target.value)}
                />
              </div>
              <div>
                <Label>Data</Label>
                <DateInput value={newDate} onChange={setNewDate} />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Checkbox checked={newAttach} onCheckedChange={(c) => setNewAttach(c === true)} />
              Atașează la portofoliul elevului
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Anulează</Button>
            <Button disabled={addMutation.isPending} onClick={() => addMutation.mutate()}>
              {addMutation.isPending ? "Se salvează…" : "Adaugă"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
