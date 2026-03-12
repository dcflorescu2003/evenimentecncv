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
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Accordion, AccordionContent, AccordionItem, AccordionTrigger,
} from "@/components/ui/accordion";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Plus, Pencil, BookOpen, UserPlus, X, Users } from "lucide-react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type ClassRow = Tables<"classes">;
type Rule = Tables<"class_participation_rules">;
type Session = Tables<"program_sessions">;
type Profile = Tables<"profiles">;

export default function ClassesPage() {
  const queryClient = useQueryClient();
  const [ruleDialog, setRuleDialog] = useState(false);
  const [ruleForm, setRuleForm] = useState({ class_id: "", session_id: "", required_value: 18 });
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [selectedSession, setSelectedSession] = useState<string>("all");

  // Teacher assignment state
  const [teacherDialog, setTeacherDialog] = useState(false);
  const [teacherClassId, setTeacherClassId] = useState<string>("");
  const [selectedTeacherId, setSelectedTeacherId] = useState<string>("");

  // Student assignment state
  const [studentDialog, setStudentDialog] = useState(false);
  const [studentClassId, setStudentClassId] = useState<string>("");
  const [selectedStudentId, setSelectedStudentId] = useState<string>("");
  const [removeStudentConfirm, setRemoveStudentConfirm] = useState<{ assignmentId: string; name: string } | null>(null);

  // Students list dialog
  const [studentsListClassId, setStudentsListClassId] = useState<string | null>(null);

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

  // All teachers (homeroom_teacher role)
  const { data: teachers = [] } = useQuery({
    queryKey: ["homeroom_teachers"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, profiles:user_id(id, first_name, last_name, display_name)")
        .eq("role", "homeroom_teacher");
      if (error) throw error;
      return (data || []).map((r: any) => r.profiles).filter(Boolean) as Profile[];
    },
  });

  // All students
  const { data: students = [] } = useQuery({
    queryKey: ["all_students"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("user_roles")
        .select("user_id, profiles:user_id(id, first_name, last_name, display_name)")
        .eq("role", "student");
      if (error) throw error;
      return (data || []).map((r: any) => r.profiles).filter(Boolean) as Profile[];
    },
  });

  // All student-class assignments
  const { data: studentAssignments = [] } = useQuery({
    queryKey: ["student_class_assignments"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("student_class_assignments")
        .select("*, profiles:student_id(id, first_name, last_name, display_name)");
      if (error) throw error;
      return data as any[];
    },
  });

  // Teacher name lookup
  const { data: teacherProfiles = [] } = useQuery({
    queryKey: ["teacher_profiles_for_classes"],
    queryFn: async () => {
      const teacherIds = classes.map((c) => c.homeroom_teacher_id).filter(Boolean);
      if (teacherIds.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name")
        .in("id", teacherIds as string[]);
      if (error) throw error;
      return data as Profile[];
    },
    enabled: classes.length > 0,
  });

  function getTeacherName(teacherId: string | null) {
    if (!teacherId) return "—";
    const p = teacherProfiles.find((t) => t.id === teacherId);
    return p ? (p.display_name || `${p.first_name} ${p.last_name}`) : "—";
  }

  function getStudentsForClass(classId: string) {
    return studentAssignments.filter((a: any) => a.class_id === classId);
  }

  // Rule mutations
  const saveRuleMutation = useMutation({
    mutationFn: async (values: typeof ruleForm) => {
      if (editingRuleId) {
        const { error } = await supabase.from("class_participation_rules")
          .update({ required_value: values.required_value, session_id: values.session_id, class_id: values.class_id })
          .eq("id", editingRuleId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("class_participation_rules")
          .insert({ class_id: values.class_id, session_id: values.session_id, required_value: values.required_value });
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

  // Teacher assignment mutation
  const assignTeacherMutation = useMutation({
    mutationFn: async ({ classId, teacherId }: { classId: string; teacherId: string }) => {
      const { error } = await supabase.from("classes")
        .update({ homeroom_teacher_id: teacherId || null })
        .eq("id", classId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["teacher_profiles_for_classes"] });
      toast.success("Diriginte asignat");
      setTeacherDialog(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Student assignment mutations
  const assignStudentMutation = useMutation({
    mutationFn: async ({ classId, studentId }: { classId: string; studentId: string }) => {
      const cls = classes.find((c) => c.id === classId);
      const { error } = await supabase.from("student_class_assignments")
        .insert({ class_id: classId, student_id: studentId, academic_year: cls?.academic_year || "2024-2025" });
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student_class_assignments"] });
      toast.success("Elev adăugat în clasă");
      setStudentDialog(false);
      setSelectedStudentId("");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const removeStudentMutation = useMutation({
    mutationFn: async (assignmentId: string) => {
      const { error } = await supabase.from("student_class_assignments").delete().eq("id", assignmentId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["student_class_assignments"] });
      toast.success("Elev eliminat din clasă");
      setRemoveStudentConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openRuleCreate(classId?: string) {
    setEditingRuleId(null);
    setRuleForm({ class_id: classId || "", session_id: sessions[0]?.id || "", required_value: 18 });
    setRuleDialog(true);
  }

  function openRuleEdit(r: Rule) {
    setEditingRuleId(r.id);
    setRuleForm({ class_id: r.class_id, session_id: r.session_id, required_value: r.required_value });
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

  // Already assigned student IDs for a class
  const assignedStudentIds = (classId: string) =>
    studentAssignments.filter((a: any) => a.class_id === classId).map((a: any) => a.student_id);

  // All assigned student IDs (across all classes)
  const allAssignedStudentIds = studentAssignments.map((a: any) => a.student_id);

  const grouped = classes.reduce<Record<number, ClassRow[]>>((acc, c) => {
    (acc[c.grade_number] = acc[c.grade_number] || []).push(c);
    return acc;
  }, {});

  function getRulesForClass(classId: string) {
    return rules.filter((r) => r.class_id === classId &&
      (selectedSession === "all" || r.session_id === selectedSession));
  }

  function getSessionName(sessionId: string) {
    return sessions.find((s) => s.id === sessionId)?.name || "—";
  }

  function ClassRowComponent({ cls }: { cls: ClassRow }) {
    const classRules = getRulesForClass(cls.id);
    const studentCount = getStudentsForClass(cls.id).length;
    return (
      <TableRow>
        <TableCell className="font-medium">{cls.display_name}</TableCell>
        <TableCell>
          <div className="flex items-center gap-2">
            <span className="text-sm">{getTeacherName(cls.homeroom_teacher_id)}</span>
            <Button variant="ghost" size="icon" className="h-6 w-6" onClick={() => {
              setTeacherClassId(cls.id);
              setSelectedTeacherId(cls.homeroom_teacher_id || "");
              setTeacherDialog(true);
            }}>
              <Pencil className="h-3 w-3" />
            </Button>
          </div>
        </TableCell>
        <TableCell>
          <Button variant="ghost" size="sm" className="h-7 gap-1" onClick={() => setStudentsListClassId(cls.id)}>
            <Users className="h-3 w-3" /> {studentCount} elevi
          </Button>
        </TableCell>
        <TableCell>
          {classRules.length === 0 ? (
            <span className="text-muted-foreground text-sm">Nicio regulă</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {classRules.map((r) => (
                <Badge key={r.id} variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => openRuleEdit(r)}>
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
  }

  // Current class for students list dialog
  const currentClassStudents = studentsListClassId ? getStudentsForClass(studentsListClassId) : [];
  const currentClassName = studentsListClassId ? classes.find((c) => c.id === studentsListClassId)?.display_name : "";

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Clase și reguli de participare</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestionare clase, diriginți, elevi și reguli de participare.
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
          <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
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
                    <TableHead>Diriginte</TableHead>
                    <TableHead>Elevi</TableHead>
                    <TableHead>Reguli</TableHead>
                    <TableHead className="w-24">Acțiuni</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {[5, 6, 7, 8].flatMap((g) => (grouped[g] || []).map((cls) => (
                    <ClassRowComponent key={cls.id} cls={cls} />
                  )))}
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
                            <TableHead>Diriginte</TableHead>
                            <TableHead>Elevi</TableHead>
                            <TableHead>Reguli</TableHead>
                            <TableHead className="w-24">Acțiuni</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {gradeClasses.map((cls) => (
                            <ClassRowComponent key={cls.id} cls={cls} />
                          ))}
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
            <DialogDescription>Definiți numărul de ore necesar pentru o clasă într-o sesiune.</DialogDescription>
          </DialogHeader>
          <form onSubmit={handleRuleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label>Clasă *</Label>
              <Select value={ruleForm.class_id} onValueChange={(v) => setRuleForm({ ...ruleForm, class_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selectați clasa" /></SelectTrigger>
                <SelectContent>
                  {classes.map((c) => (<SelectItem key={c.id} value={c.id}>{c.display_name}</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Sesiune *</Label>
              <Select value={ruleForm.session_id} onValueChange={(v) => setRuleForm({ ...ruleForm, session_id: v })}>
                <SelectTrigger><SelectValue placeholder="Selectați sesiunea" /></SelectTrigger>
                <SelectContent>
                  {sessions.map((s) => (<SelectItem key={s.id} value={s.id}>{s.name} ({s.academic_year})</SelectItem>))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Ore necesare *</Label>
              <Input type="number" min={1} max={100} value={ruleForm.required_value}
                onChange={(e) => setRuleForm({ ...ruleForm, required_value: parseInt(e.target.value) || 0 })} />
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

      {/* Assign Teacher Dialog */}
      <Dialog open={teacherDialog} onOpenChange={(o) => !o && setTeacherDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Asignează diriginte</DialogTitle>
            <DialogDescription>Selectează dirigintele pentru această clasă.</DialogDescription>
          </DialogHeader>
          <Select value={selectedTeacherId} onValueChange={setSelectedTeacherId}>
            <SelectTrigger><SelectValue placeholder="Selectează diriginte" /></SelectTrigger>
            <SelectContent>
              <SelectItem value="none">— Fără diriginte —</SelectItem>
              {teachers.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.display_name || `${t.first_name} ${t.last_name}`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTeacherDialog(false)}>Anulează</Button>
            <Button onClick={() => assignTeacherMutation.mutate({
              classId: teacherClassId,
              teacherId: selectedTeacherId === "none" ? "" : selectedTeacherId,
            })} disabled={assignTeacherMutation.isPending}>
              Salvează
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Students List Dialog */}
      <Dialog open={!!studentsListClassId} onOpenChange={(o) => !o && setStudentsListClassId(null)}>
        <DialogContent className="max-w-lg max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Elevii din {currentClassName}</DialogTitle>
            <DialogDescription>{currentClassStudents.length} elevi asignați</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            {currentClassStudents.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Niciun elev asignat.</p>
            ) : (
              currentClassStudents.map((a: any) => {
                const p = a.profiles;
                const name = p?.display_name || `${p?.first_name} ${p?.last_name}`;
                return (
                  <div key={a.id} className="flex items-center justify-between rounded-lg border px-3 py-2">
                    <span className="text-sm font-medium">{name}</span>
                    <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setRemoveStudentConfirm({ assignmentId: a.id, name })}>
                      <X className="h-3 w-3 text-destructive" />
                    </Button>
                  </div>
                );
              })
            )}
          </div>
          <div className="flex justify-end">
            <Button size="sm" onClick={() => {
              setStudentClassId(studentsListClassId!);
              setStudentDialog(true);
            }}>
              <UserPlus className="mr-2 h-4 w-4" /> Adaugă elev
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Add Student Dialog */}
      <Dialog open={studentDialog} onOpenChange={(o) => !o && setStudentDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adaugă elev în clasă</DialogTitle>
            <DialogDescription>Selectează elevul de adăugat.</DialogDescription>
          </DialogHeader>
          <Select value={selectedStudentId} onValueChange={setSelectedStudentId}>
            <SelectTrigger><SelectValue placeholder="Selectează elev" /></SelectTrigger>
            <SelectContent>
              {students
                .filter((s) => !allAssignedStudentIds.includes(s.id))
                .map((s) => (
                  <SelectItem key={s.id} value={s.id}>
                    {s.display_name || `${s.first_name} ${s.last_name}`}
                  </SelectItem>
                ))}
            </SelectContent>
          </Select>
          <DialogFooter>
            <Button variant="outline" onClick={() => setStudentDialog(false)}>Anulează</Button>
            <Button disabled={!selectedStudentId || assignStudentMutation.isPending}
              onClick={() => assignStudentMutation.mutate({ classId: studentClassId, studentId: selectedStudentId })}>
              Adaugă
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Remove Student Confirmation */}
      <AlertDialog open={!!removeStudentConfirm} onOpenChange={(o) => !o && setRemoveStudentConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Elimină elevul?</AlertDialogTitle>
            <AlertDialogDescription>
              Elimini pe <strong>{removeStudentConfirm?.name}</strong> din clasă?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={() => removeStudentConfirm && removeStudentMutation.mutate(removeStudentConfirm.assignmentId)}>
              Elimină
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
