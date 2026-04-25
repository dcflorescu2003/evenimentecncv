import { useState } from "react";
import { Checkbox } from "@/components/ui/checkbox";
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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandGroup } from "@/components/ui/command";
import { Plus, Pencil, BookOpen, UserPlus, X, Users, Check, ChevronsUpDown, Trash2, ArrowUp } from "lucide-react";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type ClassRow = Tables<"classes">;
type Rule = Tables<"class_participation_rules">;
type Session = Tables<"program_sessions">;
type Profile = Tables<"profiles">;

export default function ClassesPage() {
  const queryClient = useQueryClient();
  const [ruleDialog, setRuleDialog] = useState(false);
  const [ruleForm, setRuleForm] = useState({ class_id: "", session_id: "", required_value: 18, no_limit: false, max_hours: null as number | null, no_max_limit: true });
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

  // Edit class state
  const [editClassDialog, setEditClassDialog] = useState(false);
  const [editClassForm, setEditClassForm] = useState({ id: "", display_name: "", grade_number: 0, section: "" });

  // Delete class state
  const [deleteClassConfirm, setDeleteClassConfirm] = useState<{ id: string; name: string } | null>(null);

  // Promote classes state
  const [promoteDialog, setPromoteDialog] = useState(false);
  const currentYear = new Date().getMonth() >= 7 ? new Date().getFullYear() : new Date().getFullYear() - 1;
  const defaultNewYear = `${currentYear + 1}-${currentYear + 2}`;
  const [promoteYear, setPromoteYear] = useState(defaultNewYear);
  const [promoteConfirmText, setPromoteConfirmText] = useState("");

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
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "homeroom_teacher");
      if (roleError) throw roleError;
      const ids = (roleData || []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name")
        .in("id", ids)
        .order("last_name")
        .order("first_name");
      if (error) throw error;
      return data as Profile[];
    },
  });

  // All students - batch fetch to handle large lists
  const { data: students = [] } = useQuery({
    queryKey: ["all_students"],
    queryFn: async () => {
      const { data: roleData, error: roleError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student")
        .limit(10000);
      if (roleError) throw roleError;
      const ids = (roleData || []).map((r) => r.user_id);
      if (ids.length === 0) return [];
      // Batch fetch profiles in chunks to avoid URL length limits
      const allProfiles: Profile[] = [];
      for (let i = 0; i < ids.length; i += 200) {
        const chunk = ids.slice(i, i + 200);
        const { data, error } = await supabase
          .from("profiles")
          .select("id, first_name, last_name, display_name")
          .in("id", chunk);
        if (error) throw error;
        if (data) allProfiles.push(...(data as Profile[]));
      }
      return allProfiles.sort((a, b) => {
        const cmp = (a.last_name || "").localeCompare(b.last_name || "");
        return cmp !== 0 ? cmp : (a.first_name || "").localeCompare(b.first_name || "");
      });
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
    return p ? (`${p.last_name} ${p.first_name}`) : "—";
  }

  function getStudentsForClass(classId: string) {
    return studentAssignments.filter((a: any) => a.class_id === classId);
  }

  // Rule mutations
  const saveRuleMutation = useMutation({
    mutationFn: async (values: typeof ruleForm) => {
      const payload = {
        required_value: values.required_value,
        session_id: values.session_id,
        class_id: values.class_id,
        max_hours: values.no_max_limit ? null : (values.max_hours || null),
      };
      if (editingRuleId) {
        const { error } = await supabase.from("class_participation_rules")
          .update(payload)
          .eq("id", editingRuleId);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("class_participation_rules")
          .insert(payload);
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
    setRuleForm({ class_id: classId || "", session_id: sessions[0]?.id || "", required_value: 18, no_limit: false, max_hours: null, no_max_limit: true });
    setRuleDialog(true);
  }

  function openRuleEdit(r: Rule) {
    setEditingRuleId(r.id);
    const ruleMaxHours = (r as any).max_hours as number | null;
    setRuleForm({ class_id: r.class_id, session_id: r.session_id, required_value: r.required_value, no_limit: r.required_value === 0, max_hours: ruleMaxHours, no_max_limit: ruleMaxHours === null || ruleMaxHours === undefined });
    setRuleDialog(true);
  }

  function closeRuleDialog() {
    setRuleDialog(false);
    setEditingRuleId(null);
  }

  function handleRuleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!ruleForm.class_id || !ruleForm.session_id) {
      toast.error("Completați toate câmpurile");
      return;
    }
    if (!ruleForm.no_limit && ruleForm.required_value < 1) {
      toast.error("Introduceți un număr valid de ore");
      return;
    }
    saveRuleMutation.mutate({ ...ruleForm, required_value: ruleForm.no_limit ? 0 : ruleForm.required_value });
  }

  // Edit class mutation
  const editClassMutation = useMutation({
    mutationFn: async (values: typeof editClassForm) => {
      const { error } = await supabase.from("classes")
        .update({ display_name: values.display_name, grade_number: values.grade_number, section: values.section || null })
        .eq("id", values.id);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      toast.success("Clasă actualizată");
      setEditClassDialog(false);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete class mutation
  const deleteClassMutation = useMutation({
    mutationFn: async (classId: string) => {
      // Delete assignments and rules first
      await supabase.from("student_class_assignments").delete().eq("class_id", classId);
      await supabase.from("class_participation_rules").delete().eq("class_id", classId);
      const { error } = await supabase.from("classes").delete().eq("id", classId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["student_class_assignments"] });
      queryClient.invalidateQueries({ queryKey: ["class_participation_rules"] });
      toast.success("Clasă ștearsă");
      setDeleteClassConfirm(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Delete rule mutation
  const deleteRuleMutation = useMutation({
    mutationFn: async (ruleId: string) => {
      const { error } = await supabase.from("class_participation_rules").delete().eq("id", ruleId);
      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["class_participation_rules"] });
      toast.success("Regulă ștearsă");
      closeRuleDialog();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  // Promote classes mutation
  const promoteMutation = useMutation({
    mutationFn: async (newYear: string) => {
      const { data, error } = await supabase.functions.invoke("admin-promote-classes", {
        body: { new_academic_year: newYear },
      });
      if (error) throw error;
      if ((data as any)?.error) throw new Error((data as any).error);
      return data as { promoted_classes: number; converted_classes: number; deleted_students: number };
    },
    onSuccess: (res) => {
      queryClient.invalidateQueries({ queryKey: ["classes"] });
      queryClient.invalidateQueries({ queryKey: ["student_class_assignments"] });
      queryClient.invalidateQueries({ queryKey: ["all_students"] });
      queryClient.invalidateQueries({ queryKey: ["teacher_profiles_for_classes"] });
      toast.success(
        `Promovare reușită: ${res.promoted_classes} clase promovate, ${res.converted_classes} clase convertite (V/IX), ${res.deleted_students} elevi absolvenți șterși.`
      );
      setPromoteDialog(false);
      setPromoteConfirmText("");
    },
    onError: (e: Error) => toast.error(e.message),
  });
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
              {classRules.map((r) => {
                const rMax = (r as any).max_hours as number | null;
                const reqLabel = r.required_value === 0 ? "∞" : `${r.required_value}h`;
                const maxLabel = rMax === null || rMax === undefined ? "∞" : `${rMax}h`;
                return (
                  <Badge key={r.id} variant="outline" className="cursor-pointer hover:bg-accent" onClick={() => openRuleEdit(r)}>
                    {getSessionName(r.session_id)}: {reqLabel} necesar / max {maxLabel}
                  </Badge>
                );
              })}
            </div>
          )}
        </TableCell>
        <TableCell>
          <div className="flex items-center gap-1">
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => openRuleCreate(cls.id)} title="Adaugă regulă">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => {
              setEditClassForm({ id: cls.id, display_name: cls.display_name, grade_number: cls.grade_number, section: cls.section || "" });
              setEditClassDialog(true);
            }} title="Editează clasa">
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button variant="ghost" size="icon" className="h-7 w-7 text-destructive hover:text-destructive" onClick={() => {
              setDeleteClassConfirm({ id: cls.id, name: cls.display_name });
            }} title="Șterge clasa">
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </TableCell>
      </TableRow>
    );
  }

  function ClassCardComponent({ cls }: { cls: ClassRow }) {
    const classRules = getRulesForClass(cls.id);
    const studentCount = getStudentsForClass(cls.id).length;
    return (
      <div className="rounded-lg border p-3 space-y-2">
        <div className="flex items-start justify-between gap-2">
          <div className="font-medium text-base">{cls.display_name}</div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => openRuleCreate(cls.id)} title="Adaugă regulă">
              <Plus className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9" onClick={() => {
              setEditClassForm({ id: cls.id, display_name: cls.display_name, grade_number: cls.grade_number, section: cls.section || "" });
              setEditClassDialog(true);
            }} title="Editează clasa">
              <Pencil className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-9 w-9 text-destructive hover:text-destructive" onClick={() => {
              setDeleteClassConfirm({ id: cls.id, name: cls.display_name });
            }} title="Șterge clasa">
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <span className="text-muted-foreground">Diriginte:</span>
          <span className="flex-1 truncate">{getTeacherName(cls.homeroom_teacher_id)}</span>
          <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={() => {
            setTeacherClassId(cls.id);
            setSelectedTeacherId(cls.homeroom_teacher_id || "");
            setTeacherDialog(true);
          }}>
            <Pencil className="h-3.5 w-3.5" />
          </Button>
        </div>
        <Button variant="outline" size="sm" className="w-full justify-start gap-2" onClick={() => setStudentsListClassId(cls.id)}>
          <Users className="h-4 w-4" /> {studentCount} elevi
        </Button>
        <div>
          <div className="text-xs text-muted-foreground mb-1">Reguli:</div>
          {classRules.length === 0 ? (
            <span className="text-muted-foreground text-xs">Nicio regulă</span>
          ) : (
            <div className="flex flex-wrap gap-1">
              {classRules.map((r) => {
                const rMax = (r as any).max_hours as number | null;
                const reqLabel = r.required_value === 0 ? "∞" : `${r.required_value}h`;
                const maxLabel = rMax === null || rMax === undefined ? "∞" : `${rMax}h`;
                return (
                  <Badge key={r.id} variant="outline" className="cursor-pointer hover:bg-accent text-xs" onClick={() => openRuleEdit(r)}>
                    {getSessionName(r.session_id)}: {reqLabel}/{maxLabel}
                  </Badge>
                );
              })}
            </div>
          )}
        </div>
      </div>
    );
  }

  // Current class for students list dialog
  const currentClassStudents = studentsListClassId ? getStudentsForClass(studentsListClassId) : [];
  const currentClassName = studentsListClassId ? classes.find((c) => c.id === studentsListClassId)?.display_name : "";

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Clase și reguli de participare</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Gestionare clase, diriginți, elevi și reguli de participare.
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <Button variant="outline" onClick={() => { setPromoteYear(defaultNewYear); setPromoteConfirmText(""); setPromoteDialog(true); }} className="w-full sm:w-auto">
            <ArrowUp className="mr-2 h-4 w-4" /> Promovează clasele
          </Button>
          <Button onClick={() => openRuleCreate()} className="w-full sm:w-auto">
            <Plus className="mr-2 h-4 w-4" /> Regulă nouă
          </Button>
        </div>
      </div>

      {/* Session filter */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-3">
        <Label className="sm:whitespace-nowrap">Filtrează după sesiune:</Label>
        <Select value={selectedSession} onValueChange={setSelectedSession}>
          <SelectTrigger className="w-full sm:w-64"><SelectValue /></SelectTrigger>
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
          <TabsList className="w-full sm:w-auto">
            <TabsTrigger value="middle" className="flex-1 sm:flex-none">Gimnaziu (V–VIII)</TabsTrigger>
            <TabsTrigger value="high" className="flex-1 sm:flex-none">Liceu (IX–XII)</TabsTrigger>
          </TabsList>

          <TabsContent value="middle">
            <div className="hidden md:block rounded-lg border">
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
            <div className="md:hidden space-y-2">
              {[5, 6, 7, 8].flatMap((g) => (grouped[g] || []).map((cls) => (
                <ClassCardComponent key={cls.id} cls={cls} />
              )))}
            </div>
          </TabsContent>

          <TabsContent value="high">
            <Accordion type="multiple" className="space-y-2">
              {[9, 10, 11, 12].map((grade) => {
                const gradeClasses = grouped[grade] || [];
                return (
                  <AccordionItem key={grade} value={`grade-${grade}`} className="rounded-lg border px-3 sm:px-4">
                    <AccordionTrigger className="hover:no-underline">
                      <div className="flex items-center gap-2">
                        <BookOpen className="h-4 w-4 text-muted-foreground" />
                        <span className="font-medium">Clasa a {grade === 9 ? "IX" : grade === 10 ? "X" : grade === 11 ? "XI" : "XII"}-a</span>
                        <Badge variant="secondary">{gradeClasses.length} secțiuni</Badge>
                      </div>
                    </AccordionTrigger>
                    <AccordionContent>
                      <div className="hidden md:block">
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
                      </div>
                      <div className="md:hidden space-y-2 pb-2">
                        {gradeClasses.map((cls) => (
                          <ClassCardComponent key={cls.id} cls={cls} />
                        ))}
                      </div>
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
            <div className="flex items-center space-x-2">
              <Checkbox
                id="no_limit"
                checked={ruleForm.no_limit}
                onCheckedChange={(checked) => setRuleForm({ ...ruleForm, no_limit: !!checked })}
              />
              <Label htmlFor="no_limit">Fără limită de ore (participare nelimitată)</Label>
            </div>
            {!ruleForm.no_limit && (
              <div className="space-y-2">
                <Label>Ore necesare (obiectiv) *</Label>
                <Input type="number" min={1} max={100} value={ruleForm.required_value}
                  onChange={(e) => setRuleForm({ ...ruleForm, required_value: parseInt(e.target.value) || 0 })} />
              </div>
            )}
            <div className="flex items-center space-x-2">
              <Checkbox
                id="no_max_limit"
                checked={ruleForm.no_max_limit}
                onCheckedChange={(checked) => setRuleForm({ ...ruleForm, no_max_limit: !!checked, max_hours: !!checked ? null : (ruleForm.max_hours || 24) })}
              />
              <Label htmlFor="no_max_limit">Fără limită maximă de ore (rezervare nelimitată)</Label>
            </div>
            {!ruleForm.no_max_limit && (
              <div className="space-y-2">
                <Label>Nr. maxim de ore (limită rezervare) *</Label>
                <Input type="number" min={1} max={200} value={ruleForm.max_hours || ""}
                  onChange={(e) => setRuleForm({ ...ruleForm, max_hours: parseInt(e.target.value) || null })} />
              </div>
            )}
            <DialogFooter>
              {editingRuleId && (
                <Button type="button" variant="destructive" className="mr-auto" onClick={() => deleteRuleMutation.mutate(editingRuleId)}
                  disabled={deleteRuleMutation.isPending}>
                  Șterge regula
                </Button>
              )}
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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between">
                {selectedTeacherId && selectedTeacherId !== "none"
                  ? (() => { const t = teachers.find(t => t.id === selectedTeacherId); return t ? (`${t.last_name} ${t.first_name}`) : "Selectează diriginte"; })()
                  : "Selectează diriginte"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Caută profesor..." />
                <CommandList>
                  <CommandEmpty>Niciun profesor găsit.</CommandEmpty>
                  <CommandGroup>
                    <CommandItem value="none" onSelect={() => setSelectedTeacherId("none")}>
                      <Check className={cn("mr-2 h-4 w-4", selectedTeacherId === "none" ? "opacity-100" : "opacity-0")} />
                      — Fără diriginte —
                    </CommandItem>
                    {teachers.map((t) => {
                      const name = `${t.last_name} ${t.first_name}`;
                      return (
                        <CommandItem key={t.id} value={name} onSelect={() => setSelectedTeacherId(t.id)}>
                          <Check className={cn("mr-2 h-4 w-4", selectedTeacherId === t.id ? "opacity-100" : "opacity-0")} />
                          {name}
                        </CommandItem>
                      );
                    })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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
                const name = `${p?.last_name} ${p?.first_name}`;
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
          <Popover>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" className="w-full justify-between">
                {selectedStudentId
                  ? (() => { const s = students.find(s => s.id === selectedStudentId); return s ? (`${s.last_name} ${s.first_name}`) : "Selectează elev"; })()
                  : "Selectează elev"}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full p-0" align="start">
              <Command>
                <CommandInput placeholder="Caută elev..." />
                <CommandList>
                  <CommandEmpty>Niciun elev găsit.</CommandEmpty>
                  <CommandGroup>
                    {students
                      .filter((s) => !allAssignedStudentIds.includes(s.id))
                      .map((s) => {
                        const name = `${s.last_name} ${s.first_name}`;
                        return (
                          <CommandItem key={s.id} value={name} onSelect={() => setSelectedStudentId(s.id)}>
                            <Check className={cn("mr-2 h-4 w-4", selectedStudentId === s.id ? "opacity-100" : "opacity-0")} />
                            {name}
                          </CommandItem>
                        );
                      })}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
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

      {/* Edit Class Dialog */}
      <Dialog open={editClassDialog} onOpenChange={(o) => !o && setEditClassDialog(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editare clasă</DialogTitle>
            <DialogDescription>Modificați detaliile clasei.</DialogDescription>
          </DialogHeader>
          <form onSubmit={(e) => { e.preventDefault(); editClassMutation.mutate(editClassForm); }} className="space-y-4">
            <div className="space-y-2">
              <Label>Nume afișat *</Label>
              <Input value={editClassForm.display_name}
                onChange={(e) => setEditClassForm({ ...editClassForm, display_name: e.target.value })} />
            </div>
            <div className="space-y-2">
              <Label>Număr clasă *</Label>
              <Input type="number" min={1} max={12} value={editClassForm.grade_number}
                onChange={(e) => setEditClassForm({ ...editClassForm, grade_number: parseInt(e.target.value) || 0 })} />
            </div>
            <div className="space-y-2">
              <Label>Secțiune</Label>
              <Input value={editClassForm.section}
                onChange={(e) => setEditClassForm({ ...editClassForm, section: e.target.value })} />
            </div>
            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => setEditClassDialog(false)}>Anulează</Button>
              <Button type="submit" disabled={editClassMutation.isPending}>
                {editClassMutation.isPending ? "Se salvează…" : "Salvează"}
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Delete Class Confirmation */}
      <AlertDialog open={!!deleteClassConfirm} onOpenChange={(o) => !o && setDeleteClassConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Șterge clasa?</AlertDialogTitle>
            <AlertDialogDescription>
              Sigur doriți să ștergeți clasa <strong>{deleteClassConfirm?.name}</strong>? Toți elevii vor fi dezasignați și regulile de participare vor fi șterse.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Anulează</AlertDialogCancel>
            <AlertDialogAction onClick={() => deleteClassConfirm && deleteClassMutation.mutate(deleteClassConfirm.id)}>
              Șterge
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Promote Classes Dialog */}
      <Dialog open={promoteDialog} onOpenChange={(o) => { if (!o && !promoteMutation.isPending) { setPromoteDialog(false); setPromoteConfirmText(""); } }}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Promovează toate clasele</DialogTitle>
            <DialogDescription>
              Acțiune ireversibilă. Toate clasele vor fi promovate cu un an. Elevii din clasele a VIII-a și a XII-a vor fi șterși definitiv (cont, rezervări, bilete, formulare). Clasele a VIII-a devin clase a V-a goale, iar clasele a XII-a devin clase a IX-a goale (dirigintele se păstrează).
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            {(() => {
              const g8 = (grouped[8] || []).length;
              const g12 = (grouped[12] || []).length;
              const studentsToDelete = studentAssignments.filter((a: any) => {
                const cls = classes.find((c) => c.id === a.class_id);
                return cls && (cls.grade_number === 8 || cls.grade_number === 12);
              }).length;
              const promoted = classes.filter((c) => c.grade_number >= 5 && c.grade_number <= 7 || c.grade_number >= 9 && c.grade_number <= 11).length;
              return (
                <div className="rounded-md border bg-muted/30 p-3 text-sm space-y-1">
                  <div>• <strong>{promoted}</strong> clase promovate cu un an (V→VI, VI→VII, VII→VIII, IX→X, X→XI, XI→XII)</div>
                  <div>• <strong>{g8 + g12}</strong> clase resetate ({g8} de a VIII-a → V, {g12} de a XII-a → IX)</div>
                  <div className="text-destructive">• <strong>{studentsToDelete}</strong> elevi absolvenți vor fi șterși definitiv</div>
                </div>
              );
            })()}
            <div className="space-y-2">
              <Label>Anul școlar nou *</Label>
              <Input
                value={promoteYear}
                onChange={(e) => setPromoteYear(e.target.value)}
                placeholder="ex: 2026-2027"
              />
              <p className="text-xs text-muted-foreground">Format: AAAA-AAAA</p>
            </div>
            <div className="space-y-2">
              <Label>Pentru confirmare, tastați <code className="px-1 rounded bg-muted">PROMOVEAZĂ</code></Label>
              <Input
                value={promoteConfirmText}
                onChange={(e) => setPromoteConfirmText(e.target.value)}
                placeholder="PROMOVEAZĂ"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setPromoteDialog(false)} disabled={promoteMutation.isPending}>
              Anulează
            </Button>
            <Button
              variant="destructive"
              disabled={promoteMutation.isPending || promoteConfirmText !== "PROMOVEAZĂ" || !/^\d{4}-\d{4}$/.test(promoteYear)}
              onClick={() => promoteMutation.mutate(promoteYear)}
            >
              {promoteMutation.isPending ? "Se promovează…" : "Promovează clasele"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
