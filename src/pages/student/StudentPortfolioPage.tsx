import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter, DialogDescription,
} from "@/components/ui/dialog";
import { FileText, Download, Upload, Send, Star, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  formatBytes, getPortfolioFileUrl, uploadSubmissionFile, deletePortfolioFile,
  validatePortfolioFile, statusColor, statusLabel,
} from "@/lib/portfolio";
import StudentInvolvementTab from "@/components/portfolio/StudentInvolvementTab";

interface AssignmentRow {
  id: string;
  title: string;
  description: string | null;
  due_date: string | null;
  allow_text: boolean;
  allow_files: boolean;
  teacher_id: string;
  teacher: { first_name: string; last_name: string } | null;
  submission: {
    id: string;
    text_content: string | null;
    status: string;
    teacher_feedback: string | null;
    submitted_at: string;
    files: { id: string; file_path: string; file_name: string; file_size: number | null }[];
  } | null;
}

interface ItemRow {
  id: string;
  title: string;
  description: string | null;
  source: string;
  file_path: string | null;
  file_name: string | null;
  file_size: number | null;
  pinned: boolean;
  created_at: string;
  teacher: { first_name: string; last_name: string } | null;
}

export default function StudentPortfolioPage() {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [active, setActive] = useState<AssignmentRow | null>(null);
  const [text, setText] = useState("");
  const [files, setFiles] = useState<File[]>([]);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: assignments = [], isLoading: loadingA } = useQuery({
    queryKey: ["student_portfolio_assignments", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data: aRaw, error } = await supabase
        .from("portfolio_assignments")
        .select("id, title, description, due_date, allow_text, allow_files, teacher_id, archived")
        .eq("archived", false)
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = aRaw ?? [];
      if (list.length === 0) return [];
      const teacherIds = Array.from(new Set(list.map((a) => a.teacher_id)));
      const [teachersRes, subsRes] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name").in("id", teacherIds),
        supabase
          .from("portfolio_submissions")
          .select("id, assignment_id, text_content, status, teacher_feedback, submitted_at, portfolio_submission_files(id, file_path, file_name, file_size)")
          .eq("student_id", user!.id)
          .in("assignment_id", list.map((a) => a.id)),
      ]);
      const tMap = new Map((teachersRes.data ?? []).map((t: any) => [t.id, t]));
      const sMap = new Map<string, any>();
      for (const s of (subsRes.data ?? []) as any[]) sMap.set(s.assignment_id, s);
      return list.map((a) => {
        const s = sMap.get(a.id);
        return {
          ...a,
          teacher: tMap.get(a.teacher_id) ?? null,
          submission: s
            ? {
                id: s.id,
                text_content: s.text_content,
                status: s.status,
                teacher_feedback: s.teacher_feedback,
                submitted_at: s.submitted_at,
                files: s.portfolio_submission_files ?? [],
              }
            : null,
        } as AssignmentRow;
      });
    },
  });

  const { data: items = [], isLoading: loadingI } = useQuery({
    queryKey: ["student_portfolio_items", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_items")
        .select("id, title, description, source, file_path, file_name, file_size, pinned, created_at, teacher_id")
        .eq("student_id", user!.id)
        .eq("visible_to_student", true)
        .order("pinned", { ascending: false })
        .order("created_at", { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as any[];
      if (list.length === 0) return [];
      const teacherIds = Array.from(new Set(list.map((i) => i.teacher_id)));
      const { data: teachers } = await supabase
        .from("profiles").select("id, first_name, last_name").in("id", teacherIds);
      const tMap = new Map((teachers ?? []).map((t: any) => [t.id, t]));
      return list.map((i) => ({ ...i, teacher: tMap.get(i.teacher_id) ?? null })) as ItemRow[];
    },
  });

  useEffect(() => {
    if (active) {
      setText(active.submission?.text_content ?? "");
      setFiles([]);
      if (fileRef.current) fileRef.current.value = "";
    }
  }, [active?.id]);

  const submitMutation = useMutation({
    mutationFn: async () => {
      if (!active) throw new Error("No assignment");
      if (!active.allow_text && !active.allow_files) throw new Error("Tema nu acceptă trimiteri");
      for (const f of files) {
        const err = validatePortfolioFile(f);
        if (err) throw new Error(err);
      }
      // upsert submission
      let submissionId = active.submission?.id;
      if (submissionId) {
        const { error } = await supabase
          .from("portfolio_submissions")
          .update({
            text_content: active.allow_text ? (text.trim() || null) : null,
            status: "pending",
            submitted_at: new Date().toISOString(),
            reviewed_at: null,
            reviewed_by: null,
            teacher_feedback: null,
          })
          .eq("id", submissionId);
        if (error) throw error;
      } else {
        const { data, error } = await supabase
          .from("portfolio_submissions")
          .insert({
            assignment_id: active.id,
            student_id: user!.id,
            text_content: active.allow_text ? (text.trim() || null) : null,
            status: "pending",
          })
          .select("id")
          .single();
        if (error) throw error;
        submissionId = data.id;
      }
      // upload new files
      if (files.length > 0 && active.allow_files) {
        const fileRows: any[] = [];
        for (const f of files) {
          const up = await uploadSubmissionFile(submissionId!, f);
          fileRows.push({
            submission_id: submissionId,
            file_path: up.path,
            file_name: up.name,
            file_size: up.size,
            mime_type: up.type,
          });
        }
        const { error } = await supabase.from("portfolio_submission_files").insert(fileRows);
        if (error) throw error;
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student_portfolio_assignments"] });
      setActive(null);
      toast.success("Trimitere salvată");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const deleteFileMutation = useMutation({
    mutationFn: async (file: { id: string; file_path: string }) => {
      try { await deletePortfolioFile(file.file_path); } catch { /* ignore */ }
      const { error } = await supabase.from("portfolio_submission_files").delete().eq("id", file.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["student_portfolio_assignments"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  async function download(path: string, name: string) {
    try {
      const url = await getPortfolioFileUrl(path);
      const a = document.createElement("a");
      a.href = url; a.download = name; a.target = "_blank"; a.rel = "noopener"; a.click();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  return (
    <div className="space-y-4">
      <div>
        <h1 className="font-display text-2xl font-bold">Portofoliu</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Trimite teme și vezi feedbackul profesorilor.
        </p>
      </div>

      <Tabs defaultValue="assignments">
        <TabsList>
          <TabsTrigger value="assignments">Teme</TabsTrigger>
          <TabsTrigger value="portfolio">Portofoliul meu</TabsTrigger>
        </TabsList>

        <TabsContent value="assignments" className="mt-4 space-y-2">
          {loadingA ? (
            <p className="text-sm text-muted-foreground">Se încarcă…</p>
          ) : assignments.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Nicio temă activă.
              </CardContent>
            </Card>
          ) : (
            assignments.map((a) => {
              const status = a.submission?.status ?? "not_submitted";
              return (
                <Card key={a.id}>
                  <CardContent className="p-4">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-medium">{a.title}</div>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                          {a.teacher && <span>{a.teacher.last_name} {a.teacher.first_name}</span>}
                          {a.due_date && (
                            <span>
                              Termen:{" "}
                              {new Date(a.due_date).toLocaleDateString("ro-RO", {
                                day: "2-digit", month: "2-digit", year: "numeric",
                              })}
                            </span>
                          )}
                          <span className={statusColor(status)}>
                            {status === "not_submitted" ? "Netrimis" : statusLabel(status)}
                          </span>
                        </div>
                      </div>
                      <Button size="sm" onClick={() => setActive(a)}>
                        {a.submission ? "Vezi / editează" : "Trimite"}
                      </Button>
                    </div>
                    {a.submission?.teacher_feedback && (
                      <p className="mt-3 text-sm whitespace-pre-wrap text-muted-foreground border-l-2 border-primary/40 pl-2">
                        <strong className="text-foreground">Feedback:</strong> {a.submission.teacher_feedback}
                      </p>
                    )}
                  </CardContent>
                </Card>
              );
            })
          )}
        </TabsContent>

        <TabsContent value="portfolio" className="mt-4 space-y-2">
          {loadingI ? (
            <p className="text-sm text-muted-foreground">Se încarcă…</p>
          ) : items.length === 0 ? (
            <Card>
              <CardContent className="p-6 text-center text-sm text-muted-foreground">
                Portofoliul tău este gol.
              </CardContent>
            </Card>
          ) : (
            items.map((it) => (
              <Card key={it.id} className={it.pinned ? "border-primary/50" : ""}>
                <CardContent className="p-4">
                  <div className="flex items-center gap-2">
                    {it.pinned && <Star className="h-4 w-4 fill-primary text-primary shrink-0" />}
                    <div className="font-medium truncate">{it.title}</div>
                  </div>
                  {it.description && (
                    <p className="text-sm text-muted-foreground mt-1 whitespace-pre-wrap">{it.description}</p>
                  )}
                  <div className="text-xs text-muted-foreground mt-2 flex flex-wrap gap-x-3">
                    {it.teacher && <span>{it.teacher.last_name} {it.teacher.first_name}</span>}
                    <span>
                      {new Date(it.created_at).toLocaleDateString("ro-RO", {
                        day: "2-digit", month: "2-digit", year: "numeric",
                      })}
                    </span>
                  </div>
                  {it.file_path && it.file_name && (
                    <button
                      type="button"
                      onClick={() => download(it.file_path!, it.file_name!)}
                      className="mt-2 flex w-full items-center gap-2 rounded-md border px-2 py-1 text-sm hover:bg-muted/50"
                    >
                      <FileText className="h-4 w-4 shrink-0" />
                      <span className="truncate flex-1 text-left">{it.file_name}</span>
                      <span className="text-xs text-muted-foreground">{formatBytes(it.file_size)}</span>
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </TabsContent>
      </Tabs>

      <Dialog open={!!active} onOpenChange={(o) => !o && setActive(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl">
          <DialogHeader>
            <DialogTitle>{active?.title}</DialogTitle>
            {active?.description && (
              <DialogDescription className="whitespace-pre-wrap">{active.description}</DialogDescription>
            )}
          </DialogHeader>
          {active && (
            <div className="space-y-4">
              {active.submission && (
                <p className={`text-sm ${statusColor(active.submission.status)}`}>
                  Status: {statusLabel(active.submission.status)}
                </p>
              )}
              {active.allow_text && (
                <div>
                  <Label>Răspunsul tău</Label>
                  <Textarea
                    rows={5}
                    value={text}
                    onChange={(e) => setText(e.target.value)}
                    placeholder="Scrie aici…"
                  />
                </div>
              )}
              {active.allow_files && (
                <div className="space-y-2">
                  <Label>Fișiere (max 10MB fiecare)</Label>
                  {active.submission?.files && active.submission.files.length > 0 && (
                    <div className="space-y-1">
                      {active.submission.files.map((f) => (
                        <div key={f.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
                          <FileText className="h-4 w-4 shrink-0" />
                          <span className="min-w-0 flex-1 truncate">{f.file_name}</span>
                          <span className="text-xs text-muted-foreground">{formatBytes(f.file_size)}</span>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => download(f.file_path, f.file_name)}
                          >
                            <Download className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            onClick={() => deleteFileMutation.mutate(f)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      ))}
                    </div>
                  )}
                  <Input
                    ref={fileRef}
                    type="file"
                    multiple
                    onChange={(e) => setFiles(Array.from(e.target.files ?? []))}
                  />
                  {files.length > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {files.length} fișier(e) selectate
                    </p>
                  )}
                </div>
              )}
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setActive(null)}>Închide</Button>
            <Button
              disabled={submitMutation.isPending}
              onClick={() => submitMutation.mutate()}
            >
              {submitMutation.isPending ? (
                <><Upload className="h-4 w-4 mr-1 animate-pulse" /> Se trimite…</>
              ) : (
                <><Send className="h-4 w-4 mr-1" /> {active?.submission ? "Retrimite" : "Trimite"}</>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
