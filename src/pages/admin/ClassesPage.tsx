import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
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
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, BookOpen } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type ClassRow = Tables<"classes">;
type Rule = Tables<"class_participation_rules">;
type Session = Tables<"program_sessions">;

export default function ClassesPage() {
  const queryClient = useQueryClient();
  const [ruleDialog, setRuleDialog] = useState(false);
  const [ruleForm, setRuleForm] = useState({ class_id: "", session_id: "", required_value: 18 });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string>("all");

  const { data: classes = [], isLoading } = useQuery({
    queryKey: ["classes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("*")
        .order("grade_number")
        .order("section");
      if (error) throw error;
      return data as ClassRow[];
    },
  });

  const { data: sessions = [] } = useQuery({
    queryKey: ["program_sessions"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("program_sessions")
        .select("*")
        .order("start_date", { ascending: false });
      if (error) throw error;
      return data as Session[];
    },
  });

  const { data: rules = [] } = useQuery({
    queryKey: ["class_participation_rules"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("class_participation_rules")
        .select("*");
      if (error) throw error;
      return data as Rule[];
    },
  });

  const saveRuleMutation = useMutation({
    mutationFn: async (values: typeof ruleForm) => {
      if (editingRuleId) {
        const { error } = await supabase
          .from("class_participation_rules")
          .update({
            required_value: values.required_value,
            session_id: values.session_id,
            class_id: values.class_id,
          })
          .eq("id", editingRuleId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("class_participation_rules")
          .insert({
            class_id: values.class_id,
            session_id: values.session_id,
            required_value: values.required_value,
          });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class_participation_rules"] });
      toast.success(editingRuleId ? "Regulă actualizată" : "Regulă creată");
      closeRuleDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openRuleCreate(classId?: string) {
    setEditingRuleId(null);
    setRuleForm({
      class_id: classId || "",
      session_id: sessions[0]?.id || "",
      required_value: 18,
    });
    setRuleDialog(true);
  }

  function openRuleEdit(r: Rule) {
    setEditingRuleId(r.id);
    setRuleForm({
      class_id: r.class_id,
      session_id: r.session_id,
      required_value: r.required_value,
    });
    setRuleDialog(true);
  }

  function closeRuleDialog() {
    setRuleDialog(false);
    setEditingRuleId(null);
  }

  function handleRuleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ruleForm.class_id || !ruleForm.session_id || ruleForm.required_value < 1) {
      toast.error("Completați toate câmpurile");
      return;
    }
    saveRuleMutation.mutate(ruleForm);
  }

  // Group classes by grade
  const grouped = classes.reduce<Record<number, ClassRow[]>>((acc, c) => {
    (acc[c.grade_number] = acc[c.grade_number] || []).push(c);
    return acc;
  }, {});

  const gradeLabels: Record<number, string> = {
    5: "Clasa a V-a", 6: "Clasa a VI-a", 7: "Clasa a VII-a", 8: "Clasa a VIII-a",
  };

  function getRulesForClass(classId: string) {
    return rules.filter((r) => r.class_id === classId &&
      (selectedSession === "all" || r.session_id === selectedSession));
  }

  function getSessionName(sessionId: string) {
    return sessions.find((s) => s.id === sessionId)?.name || "—";
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Clase și reguli de participare</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Vizualizare clase și gestionare reguli de participare per sesiune.
          </p>
        </div>
        <Button onClick={() => openRuleCreate()}>
          <Plus className="mr-2 h-4 w-4" /> Regulă nouă
        </Button>
      </div>

      {/* Session filter */}
      <div className="flex items-center gap-3">
        <Label>Filtrează după sesiune:</Label>
        <Select value={selectedSession} onValueChange={setSelectedSession}>
          <SelectTrigger className="w-64">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Toate sesiunile</SelectItem>
            {sessions.map((s) => (
              <SelectItem key={s.id} value={s.id}>{s.name} ({s.academic_year})</SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {isLoading ? (
        <p className="text-muted-foreground">Se încarcă…</p>
      ) : (
        <Tabs defaultValue="high" className="space-y-4">
          <TabsList>
            <TabsTrigger value="middle">Gimnaziu (V–VIII)</TabsTrigger>
            <TabsTrigger value="high">Liceu (IX–XII)</TabsTrigger>
          </TabsList>

          <TabsContent value="middle">
            <div className="rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Clasă</TableHead>
                    <TableHead>Reguli</TableHead>
                    <TableHead className="w-24">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[5, 6, 7, 8].map((g) => {
                    const cls = grouped[g]?.[0];
                    if (!cls) return null;
                    const classRules = getRulesForClass(cls.id);
                    return (
                      <TableRow key={cls.id}>
                        <TableCell className="font-medium">{cls.display_name}</TableCell>
                        <TableCell>
                          {classRules.length === 0 ? (
                            <span className="text-muted-foreground text-sm">Nicio regulă</span>
                          ) : (
                            <div className="flex flex-wrap gap-1">
                              {classRules.map((r) => (
                                <Badge
                                  key={r.id}
                                  variant="outline"
                                  className="cursor-pointer hover:bg-accent"
                                  onClick={() => openRuleEdit(r)}
                                >
                                  {getSessionName(r.session_id)}: {r.required_value}h
                                </Badge>
                              ))}
                            </div>
                          )}
                        </TableCell>
                        <TableCell>
                          <Button variant="ghost" size="icon" onClick={() => openRuleCreate(cls.id)}>
                            <Plus className="h-4 w-4" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          </TabsContent>

          <TabsContent value="high">
            <Accordion type="multiple" className="space-y-2">
              {[9, 10, 11, 12].map((grade) => {
                const gradeClasses = grouped[grade] || [];
                return (
                  <AccordionItem key={grade} value={`grade-${grade}`} className="rounded-lg border px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Clasa a {grade === 9 ? "IX" : grade === 10 ? "X" : grade === 11 ? "XI" : "XII"}-a</span>
                        <Badge variant="secondary">{gradeClasses.length} secțiuni</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <Table>
                        <TableHeader>
                          <TableRow>
                            <TableHead>Secțiune</TableHead>
                            <TableHead>Reguli</TableHead>
                            <TableHead className="w-24">Acțiuni</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gradeClasses.map((cls) => {
                            const classRules = getRulesForClass(cls.id);
                            return (
                              <TableRow key={cls.id}>
                                <TableCell className="font-medium">{cls.display_name}</TableCell>
                                <TableCell>
                                  {classRules.length === 0 ? (
                                    <span className="text-muted-foreground text-sm">Nicio regulă</span>
                                  ) : (
                                    <div className="flex flex-wrap gap-1">
                                      {classRules.map((r) => (
                                        <Badge
                                          key={r.id}
                                          variant="outline"
                                          className="cursor-pointer hover:bg-accent"
                                          onClick={() => openRuleEdit(r)}
                                        >
                                          {getSessionName(r.session_id)}: {r.required_value}h
                                        </Badge>
                                      ))}
                                    </div>
                                  )}
                                </TableCell>
                                <TableCell>
                                  <Button variant="ghost" size="icon" onClick={() => openRuleCreate(cls.id)}>
                                    <Plus className="h-4 w-4" />
                                  </Button>
                                </TableCell>
                              </TableRow>
                            );
                          })}
                        </TableBody>
                      </Table>
                    </AccordionContent>
                  </AccordionItem>
                );
              })}
            </Accordion>
          </TabsContent>
        </Tabs>
      )}

      {/* Rule Dialog */}
      <Dialog open={ruleDialog} onOpenChange={(o) => !o && closeRuleDialog()}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editingRuleId ? "Editare regulă" : "Regulă nouă de participare"}</DialogTitle>
            <DialogDescription>
              Definiți numărul de ore necesar pentru o clasă într-o sesiune.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRuleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Clasă *</Label>
              <Select value={ruleForm.class_id} onValueChange={(v) => setRuleForm({ ...ruleForm, class_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectați clasa" />
                </SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sesiune *</Label>
              <Select value={ruleForm.session_id} onValueChange={(v) => setRuleForm({ ...ruleForm, session_id: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Selectați sesiunea" />
                </SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (
                    <SelectItem key={s.id} value={s.id}>{s.name} ({s.academic_year})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="required_value">Ore necesare *</Label>
              <Input
                id="required_value"
                type="number"
                min={1}
                max={100}
                value={ruleForm.required_value}
                onChange={(e) => setRuleForm({ ...ruleForm, required_value: parseInt(e.target.value) || 0 })}
              />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={closeRuleDialog}>Anulează</Button>
              <Button type="submit" disabled={saveRuleMutation.isPending}>
                {saveRuleMutation.isPending ? "Se salvează…" : "Salvează"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
