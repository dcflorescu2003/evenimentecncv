import { useMemo, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ChevronLeft, FileText, Download, Trash2, Plus, Pencil, UserPlus } from "lucide-react";
import { toast } from "sonner";
import {
  SIGNUP_STATUS_LABELS, SIGNUP_STATUS_ORDER, SignupStatus, AWARD_OPTIONS,
  COMPETITION_TYPE_LABELS, COMPETITION_DIFFICULTY_LABELS, COMPETITION_TEAM_LABELS,
  uploadCompetitionFile, signupStatusColor,
} from "@/lib/portfolioCompetitions";
import {
  getPortfolioFileUrl, deletePortfolioFile, formatBytes,
} from "@/lib/portfolio";

interface Competition {
  id: string;
  teacher_id: string;
  title: string;
  description: string | null;
  type: string;
  difficulty: string;
  class_ids: string[];
  signup_deadline: string | null;
  event_date: string | null;
  regulation_url: string | null;
  location: string | null;
  team_mode: string;
  academic_year: string | null;
}

interface Signup {
  id: string;
  competition_id: string;
  student_id: string;
  status: SignupStatus;
  result: string | null;
  award: string | null;
  score: number | null;
  notes: string | null;
  diploma_path: string | null;
  diploma_name: string | null;
  project_path: string | null;
  project_name: string | null;
  attach_to_portfolio: boolean;
  created_at: string;
}

interface StudentInfo {
  id: string;
  first_name: string;
  last_name: string;
  class_id: string | null;
  class_name: string | null;
}

export default function PortfolioCompetitionDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();

  const [addOpen, setAddOpen] = useState(false);
  const [addStudentId, setAddStudentId] = useState("");
  const [addStatus, setAddStatus] = useState<SignupStatus>("interested");

  const [editing, setEditing] = useState<Signup | null>(null);
  const [editForm, setEditForm] = useState({
    status: "interested" as SignupStatus,
    result: "",
    award: "",
    score: "",
    notes: "",
    attach_to_portfolio: true,
  });
  const [diplomaFile, setDiplomaFile] = useState<File | null>(null);
  const [projectFile, setProjectFile] = useState<File | null>(null);

  const { data: competition } = useQuery({
    queryKey: ["portfolio_competition_detail", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_competitions")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Competition;
    },
  });

  const { data: signups = [] } = useQuery({
    queryKey: ["portfolio_competition_signups", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_competition_signups")
        .select("*")
        .eq("competition_id", id!);
      if (error) throw error;
      return (data ?? []) as unknown as Signup[];
    },
  });

  const studentIds = signups.map((s) => s.student_id);

  const { data: signupStudents = [] } = useQuery({
    queryKey: ["portfolio_competition_signup_students", studentIds.join(",")],
    enabled: studentIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", studentIds);
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: eligibleStudents = [] } = useQuery({
    queryKey: ["portfolio_competition_eligible_students", competition?.class_ids?.join(",")],
    enabled: !!competition && (competition.class_ids?.length ?? 0) > 0,
    queryFn: async () => {
      const { data: assigns, error } = await supabase
        .from("student_class_assignments")
        .select("student_id, class_id, classes(display_name)")
        .in("class_id", competition!.class_ids);
      if (error) throw error;
      const rows = (assigns ?? []) as any[];
      const ids = Array.from(new Set(rows.map((r) => r.student_id)));
      if (ids.length === 0) return [] as StudentInfo[];
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name")
        .in("id", ids);
      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      const result: StudentInfo[] = rows.map((r) => {
        const p = pMap.get(r.student_id) ?? { first_name: "", last_name: "" };
        return {
          id: r.student_id,
          first_name: p.first_name,
          last_name: p.last_name,
          class_id: r.class_id,
          class_name: r.classes?.display_name ?? null,
        };
      });
      result.sort((a, b) =>
        a.last_name.localeCompare(b.last_name, "ro") ||
        a.first_name.localeCompare(b.first_name, "ro"),
      );
      return result;
    },
  });

  const studentName = (sid: string) => {
    const s = signupStudents.find((x: any) => x.id === sid);
    return s ? `${(s as any).last_name} ${(s as any).first_name}` : "—";
  };

  const groupedSignups = useMemo(() => {
    const groups: Record<SignupStatus, Signup[]> = {
      interested: [], selected: [], registered: [], participated: [],
    };
    for (const s of signups) groups[s.status]?.push(s);
    for (const k of Object.keys(groups) as SignupStatus[]) {
      groups[k].sort((a, b) =>
        studentName(a.student_id).localeCompare(studentName(b.student_id), "ro"),
      );
    }
    return groups;
  }, [signups, signupStudents]);

  const addSignup = useMutation({
    mutationFn: async () => {
      if (!addStudentId) throw new Error("Selectează un elev");
      const { error } = await supabase.from("portfolio_competition_signups").insert({
        competition_id: id!,
        student_id: addStudentId,
        status: addStatus,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_competition_signups", id] });
      setAddOpen(false);
      setAddStudentId("");
      setAddStatus("interested");
      toast.success("Elev adăugat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const saveSignup = useMutation({
    mutationFn: async () => {
      if (!editing) return;
      let diploma_path = editing.diploma_path;
      let diploma_name = editing.diploma_name;
      let project_path = editing.project_path;
      let project_name = editing.project_name;

      if (diplomaFile) {
        const up = await uploadCompetitionFile(editing.id, "diploma", diplomaFile);
        // remove old if exists
        if (editing.diploma_path) {
          try { await deletePortfolioFile(editing.diploma_path); } catch { /* ignore */ }
        }
        diploma_path = up.path;
        diploma_name = up.name;
      }
      if (projectFile) {
        const up = await uploadCompetitionFile(editing.id, "project", projectFile);
        if (editing.project_path) {
          try { await deletePortfolioFile(editing.project_path); } catch { /* ignore */ }
        }
        project_path = up.path;
        project_name = up.name;
      }

      const { error } = await supabase
        .from("portfolio_competition_signups")
        .update({
          status: editForm.status,
          result: editForm.result.trim() || null,
          award: editForm.award || null,
          score: editForm.score ? Number(editForm.score) : null,
          notes: editForm.notes.trim() || null,
          attach_to_portfolio: editForm.attach_to_portfolio,
          diploma_path, diploma_name, project_path, project_name,
        })
        .eq("id", editing.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_competition_signups", id] });
      setEditing(null);
      setDiplomaFile(null);
      setProjectFile(null);
      toast.success("Salvat");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteSignup = useMutation({
    mutationFn: async (s: Signup) => {
      if (s.diploma_path) { try { await deletePortfolioFile(s.diploma_path); } catch { /* */ } }
      if (s.project_path) { try { await deletePortfolioFile(s.project_path); } catch { /* */ } }
      const { error } = await supabase
        .from("portfolio_competition_signups").delete().eq("id", s.id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_competition_signups", id] });
      toast.success("Șters");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  function openEdit(s: Signup) {
    setEditing(s);
    setEditForm({
      status: s.status,
      result: s.result ?? "",
      award: s.award ?? "",
      score: s.score != null ? String(s.score) : "",
      notes: s.notes ?? "",
      attach_to_portfolio: s.attach_to_portfolio,
    });
    setDiplomaFile(null);
    setProjectFile(null);
  }

  async function download(path: string, name: string) {
    try {
      const url = await getPortfolioFileUrl(path);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.target = "_blank"; a.rel = "noopener"; a.click();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  const enrolledIds = new Set(signups.map((s) => s.student_id));
  const availableStudents = eligibleStudents.filter((s) => !enrolledIds.has(s.id));

  if (!competition) {
    return <p className="text-sm text-muted-foreground">Se încarcă…</p>;
  }

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/portfolio/competitions")}>
        <ChevronLeft className="h-4 w-4 mr-1" /> Înapoi la concursuri
      </Button>

      <div>
        <h1 className="font-display text-2xl font-bold">{competition.title}</h1>
        {competition.description && (
          <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{competition.description}</p>
        )}
        <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-3 gap-y-1">
          <span>{COMPETITION_TYPE_LABELS[competition.type as keyof typeof COMPETITION_TYPE_LABELS]}</span>
          <span>{COMPETITION_DIFFICULTY_LABELS[competition.difficulty as keyof typeof COMPETITION_DIFFICULTY_LABELS]}</span>
          <span>{COMPETITION_TEAM_LABELS[competition.team_mode as keyof typeof COMPETITION_TEAM_LABELS]}</span>
          {competition.location && <span>📍 {competition.location}</span>}
          {competition.event_date && (
            <span>Concurs: {new Date(competition.event_date).toLocaleDateString("ro-RO")}</span>
          )}
          {competition.signup_deadline && (
            <span>Înscriere până: {new Date(competition.signup_deadline).toLocaleDateString("ro-RO")}</span>
          )}
          {competition.regulation_url && (
            <a href={competition.regulation_url} target="_blank" rel="noopener noreferrer"
               className="text-primary underline">Regulament</a>
          )}
        </div>
      </div>

      <div className="flex justify-end">
        <Button onClick={() => setAddOpen(true)}>
          <UserPlus className="h-4 w-4 mr-2" /> Adaugă elev
        </Button>
      </div>

      <Tabs defaultValue="interested">
        <TabsList className="w-full justify-start overflow-x-auto whitespace-nowrap">
          {SIGNUP_STATUS_ORDER.map((k) => (
            <TabsTrigger key={k} value={k}>
              {SIGNUP_STATUS_LABELS[k]} ({groupedSignups[k]?.length ?? 0})
            </TabsTrigger>
          ))}
        </TabsList>

        {SIGNUP_STATUS_ORDER.map((k) => (
          <TabsContent key={k} value={k} className="mt-4 space-y-2">
            {groupedSignups[k]?.length === 0 ? (
              <Card>
                <CardContent className="p-6 text-center text-sm text-muted-foreground">
                  Niciun elev în această etapă.
                </CardContent>
              </Card>
            ) : (
              groupedSignups[k].map((s) => (
                <Card key={s.id}>
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">{studentName(s.student_id)}</div>
                        <div className={`text-xs ${signupStatusColor(s.status)} mt-1`}>
                          {SIGNUP_STATUS_LABELS[s.status]}
                          {s.award ? ` · ${s.award}` : ""}
                          {s.score != null ? ` · ${s.score} pct.` : ""}
                        </div>
                        {s.result && <p className="text-sm mt-1">{s.result}</p>}
                        {s.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{s.notes}</p>}
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="icon" title="Editează" onClick={() => openEdit(s)}>
                          <Pencil className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" title="Șterge"
                          onClick={() => { if (confirm("Ștergi înscrierea?")) deleteSignup.mutate(s); }}>
                          <Trash2 className="h-4 w-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {(s.diploma_path || s.project_path) && (
                      <div className="mt-2 space-y-1">
                        {s.diploma_path && s.diploma_name && (
                          <button type="button"
                            onClick={() => download(s.diploma_path!, s.diploma_name!)}
                            className="flex w-full items-center gap-2 rounded-md border px-2 py-1 text-sm hover:bg-muted/50">
                            <FileText className="h-4 w-4" />
                            <span className="truncate flex-1 text-left">🏅 {s.diploma_name}</span>
                            <Download className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                        {s.project_path && s.project_name && (
                          <button type="button"
                            onClick={() => download(s.project_path!, s.project_name!)}
                            className="flex w-full items-center gap-2 rounded-md border px-2 py-1 text-sm hover:bg-muted/50">
                            <FileText className="h-4 w-4" />
                            <span className="truncate flex-1 text-left">📁 {s.project_name}</span>
                            <Download className="h-4 w-4 text-muted-foreground" />
                          </button>
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))
            )}
          </TabsContent>
        ))}
      </Tabs>

      <Dialog open={addOpen} onOpenChange={setAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Adaugă elev la concurs</DialogTitle>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Elev</Label>
              <Select value={addStudentId} onValueChange={setAddStudentId}>
                <SelectTrigger><SelectValue placeholder="Alege un elev…" /></SelectTrigger>
                <SelectContent>
                  {availableStudents.length === 0 && (
                    <div className="px-2 py-1.5 text-sm text-muted-foreground">
                      Toți elevii eligibili sunt deja înscriși.
                    </div>
                  )}
                  {availableStudents.map((s) => (
                    <SelectItem key={s.id} value={s.id}>
                      {s.last_name} {s.first_name}
                      {s.class_name ? ` · ${s.class_name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Etapă</Label>
              <Select value={addStatus} onValueChange={(v) => setAddStatus(v as SignupStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {SIGNUP_STATUS_ORDER.map((k) => (
                    <SelectItem key={k} value={k}>{SIGNUP_STATUS_LABELS[k]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setAddOpen(false)}>Anulează</Button>
            <Button disabled={addSignup.isPending} onClick={() => addSignup.mutate()}>
              {addSignup.isPending ? "Se adaugă…" : "Adaugă"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!editing} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{editing && studentName(editing.student_id)}</DialogTitle>
          </DialogHeader>
          {editing && (
            <div className="space-y-3">
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Etapă</Label>
                  <Select value={editForm.status} onValueChange={(v) => setEditForm({ ...editForm, status: v as SignupStatus })}>
                    <SelectTrigger><SelectValue /></SelectTrigger>
                    <SelectContent>
                      {SIGNUP_STATUS_ORDER.map((k) => (
                        <SelectItem key={k} value={k}>{SIGNUP_STATUS_LABELS[k]}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label>Premiu / mențiune</Label>
                  <Select value={editForm.award || "_none"} onValueChange={(v) => setEditForm({ ...editForm, award: v === "_none" ? "" : v })}>
                    <SelectTrigger><SelectValue placeholder="—" /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="_none">—</SelectItem>
                      {AWARD_OPTIONS.map((a) => (
                        <SelectItem key={a} value={a}>{a}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid gap-3 sm:grid-cols-2">
                <div>
                  <Label>Punctaj (opțional)</Label>
                  <Input type="number" step="0.01" value={editForm.score}
                    onChange={(e) => setEditForm({ ...editForm, score: e.target.value })} />
                </div>
                <div>
                  <Label>Rezultat (text)</Label>
                  <Input value={editForm.result}
                    onChange={(e) => setEditForm({ ...editForm, result: e.target.value })}
                    placeholder="Ex: Calificat la etapa județeană" />
                </div>
              </div>
              <div>
                <Label>Observații</Label>
                <Textarea rows={2} value={editForm.notes}
                  onChange={(e) => setEditForm({ ...editForm, notes: e.target.value })} />
              </div>
              <div>
                <Label>Diplomă (PDF/imagine, max 10MB)</Label>
                {editing.diploma_path && editing.diploma_name && !diplomaFile && (
                  <div className="flex items-center gap-2 text-sm mt-1 mb-2 rounded-md border p-2">
                    <FileText className="h-4 w-4" />
                    <span className="truncate flex-1">{editing.diploma_name}</span>
                    <span className="text-xs text-muted-foreground">curentă</span>
                  </div>
                )}
                <Input type="file" accept="image/*,application/pdf"
                  onChange={(e) => setDiplomaFile(e.target.files?.[0] ?? null)} />
              </div>
              <div>
                <Label>Fișier proiect / lucrare (opțional, max 10MB)</Label>
                {editing.project_path && editing.project_name && !projectFile && (
                  <div className="flex items-center gap-2 text-sm mt-1 mb-2 rounded-md border p-2">
                    <FileText className="h-4 w-4" />
                    <span className="truncate flex-1">{editing.project_name}</span>
                    <span className="text-xs text-muted-foreground">curent</span>
                  </div>
                )}
                <Input type="file"
                  onChange={(e) => setProjectFile(e.target.files?.[0] ?? null)} />
              </div>
              <label className="flex items-center gap-2 text-sm cursor-pointer">
                <input type="checkbox" checked={editForm.attach_to_portfolio}
                  onChange={(e) => setEditForm({ ...editForm, attach_to_portfolio: e.target.checked })} />
                Atașează automat în portofoliul elevului (diploma și rezultatul)
              </label>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)}>Anulează</Button>
            <Button disabled={saveSignup.isPending} onClick={() => saveSignup.mutate()}>
              {saveSignup.isPending ? "Se salvează…" : "Salvează"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
