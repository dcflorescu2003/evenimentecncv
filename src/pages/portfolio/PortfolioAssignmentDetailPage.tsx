import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { ChevronLeft, Check, X, FileText, Download, Star } from "lucide-react";
import { toast } from "sonner";
import { formatBytes, getPortfolioFileUrl, statusColor, statusLabel } from "@/lib/portfolio";

interface Assignment {
  id: string;
  teacher_id: string;
  class_id: string | null;
  title: string;
  description: string | null;
  due_date: string | null;
  allow_files: boolean;
  allow_text: boolean;
  classes: { id: string; display_name: string } | null;
}

interface Submission {
  id: string;
  student_id: string;
  text_content: string | null;
  status: string;
  teacher_feedback: string | null;
  submitted_at: string;
  reviewed_at: string | null;
  profiles: { id: string; first_name: string; last_name: string; username: string } | null;
  portfolio_submission_files: {
    id: string; file_path: string; file_name: string; file_size: number | null;
  }[];
}

export default function PortfolioAssignmentDetailPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { user } = useAuth();
  const [reviewing, setReviewing] = useState<Submission | null>(null);
  const [feedback, setFeedback] = useState("");
  const [addToPortfolio, setAddToPortfolio] = useState(true);
  const [pinItem, setPinItem] = useState(false);

  const { data: assignment } = useQuery({
    queryKey: ["portfolio_assignment", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_assignments")
        .select("*, classes(id, display_name)")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data as unknown as Assignment | null;
    },
  });

  const { data: submissions = [], isLoading } = useQuery({
    queryKey: ["portfolio_assignment_submissions", id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_submissions")
        .select("*, portfolio_submission_files(id, file_path, file_name, file_size)")
        .eq("assignment_id", id!)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      const list = (data ?? []) as any[];
      if (list.length === 0) return [] as Submission[];
      const studentIds = Array.from(new Set(list.map((s) => s.student_id)));
      const { data: profiles } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, username")
        .in("id", studentIds);
      const pMap = new Map((profiles ?? []).map((p: any) => [p.id, p]));
      return list.map((s) => ({ ...s, profiles: pMap.get(s.student_id) ?? null })) as Submission[];
    },
  });

  const reviewMutation = useMutation({
    mutationFn: async (vars: { status: "approved" | "rejected"; addItem: boolean; pin: boolean }) => {
      if (!reviewing) throw new Error("No submission");
      const { error: upErr } = await supabase
        .from("portfolio_submissions")
        .update({
          status: vars.status,
          teacher_feedback: feedback.trim() || null,
          reviewed_at: new Date().toISOString(),
          reviewed_by: user!.id,
        })
        .eq("id", reviewing.id);
      if (upErr) throw upErr;

      if (vars.status === "approved" && vars.addItem) {
        // Create a portfolio_item for each file (or one with text-only)
        const baseTitle = assignment?.title ?? "Trimitere temă";
        if (reviewing.portfolio_submission_files.length > 0) {
          const rows = reviewing.portfolio_submission_files.map((f) => ({
            student_id: reviewing.student_id,
            teacher_id: user!.id,
            title: `${baseTitle} – ${f.file_name}`,
            description: reviewing.text_content,
            source: "submission",
            source_id: reviewing.id,
            file_path: f.file_path,
            file_name: f.file_name,
            file_size: f.file_size,
            pinned: vars.pin,
            visible_to_student: true,
          }));
          const { error } = await supabase.from("portfolio_items").insert(rows);
          if (error) throw error;
        } else {
          const { error } = await supabase.from("portfolio_items").insert({
            student_id: reviewing.student_id,
            teacher_id: user!.id,
            title: baseTitle,
            description: reviewing.text_content,
            source: "submission",
            source_id: reviewing.id,
            pinned: vars.pin,
            visible_to_student: true,
          });
          if (error) throw error;
        }
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["portfolio_assignment_submissions", id] });
      qc.invalidateQueries({ queryKey: ["portfolio_assignment_counts"] });
      qc.invalidateQueries({ queryKey: ["portfolio_dashboard_pending"] });
      setReviewing(null);
      setFeedback("");
      toast.success("Revizuit");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  async function downloadFile(path: string, name: string) {
    try {
      const url = await getPortfolioFileUrl(path);
      const a = document.createElement("a");
      a.href = url;
      a.download = name;
      a.target = "_blank";
      a.rel = "noopener";
      a.click();
    } catch (e) {
      toast.error((e as Error).message);
    }
  }

  function openReview(s: Submission) {
    setReviewing(s);
    setFeedback(s.teacher_feedback ?? "");
    setAddToPortfolio(s.status !== "approved");
    setPinItem(false);
  }

  const pending = submissions.filter((s) => s.status === "pending");
  const approved = submissions.filter((s) => s.status === "approved");
  const rejected = submissions.filter((s) => s.status === "rejected");

  return (
    <div className="space-y-4">
      <Button variant="ghost" size="sm" onClick={() => navigate("/portfolio/assignments")}>
        <ChevronLeft className="h-4 w-4 mr-1" /> Înapoi la teme
      </Button>

      <div>
        <h1 className="font-display text-2xl font-bold">{assignment?.title ?? "Temă"}</h1>
        <p className="text-sm text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
          <span>{assignment?.classes?.display_name ?? "Toate clasele mele"}</span>
          {assignment?.due_date && (
            <span>
              Termen:{" "}
              {new Date(assignment.due_date).toLocaleDateString("ro-RO", {
                day: "2-digit", month: "2-digit", year: "numeric",
              })}
            </span>
          )}
        </p>
        {assignment?.description && (
          <p className="mt-3 text-sm whitespace-pre-wrap">{assignment.description}</p>
        )}
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      ) : submissions.length === 0 ? (
        <Card>
          <CardContent className="p-6 text-center text-sm text-muted-foreground">
            Nicio trimitere încă.
          </CardContent>
        </Card>
      ) : (
        <div className="space-y-4">
          {[
            { label: "În așteptare", items: pending },
            { label: "Aprobate", items: approved },
            { label: "Respinse", items: rejected },
          ].map((group) => (
            group.items.length > 0 && (
              <div key={group.label} className="space-y-2">
                <h2 className="text-sm font-semibold text-muted-foreground uppercase">
                  {group.label} · {group.items.length}
                </h2>
                {group.items.map((s) => (
                  <Card key={s.id}>
                    <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                      <div className="min-w-0 flex-1">
                        <div className="font-medium">
                          {s.profiles ? `${s.profiles.last_name} ${s.profiles.first_name}` : "—"}
                        </div>
                        <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
                          <span className={statusColor(s.status)}>{statusLabel(s.status)}</span>
                          <span>
                            Trimis{" "}
                            {new Date(s.submitted_at).toLocaleString("ro-RO", {
                              day: "2-digit", month: "2-digit", year: "numeric",
                              hour: "2-digit", minute: "2-digit",
                            })}
                          </span>
                          {s.portfolio_submission_files.length > 0 && (
                            <span>{s.portfolio_submission_files.length} fișier(e)</span>
                          )}
                        </div>
                      </div>
                      <Button size="sm" onClick={() => openReview(s)}>
                        Vezi / revizuiește
                      </Button>
                    </CardContent>
                  </Card>
                ))}
              </div>
            )
          ))}
        </div>
      )}

      <Dialog open={!!reviewing} onOpenChange={(o) => !o && setReviewing(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>
              {reviewing?.profiles
                ? `${reviewing.profiles.last_name} ${reviewing.profiles.first_name}`
                : "Trimitere"}
            </DialogTitle>
          </DialogHeader>
          {reviewing && (
            <div className="space-y-4">
              {reviewing.text_content && (
                <div>
                  <Label className="text-xs">Răspuns</Label>
                  <div className="mt-1 rounded-md border bg-muted/30 p-3 text-sm whitespace-pre-wrap">
                    {reviewing.text_content}
                  </div>
                </div>
              )}
              {reviewing.portfolio_submission_files.length > 0 && (
                <div>
                  <Label className="text-xs">Fișiere</Label>
                  <div className="mt-1 space-y-1">
                    {reviewing.portfolio_submission_files.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => downloadFile(f.file_path, f.file_name)}
                        className="flex w-full items-center gap-2 rounded-md border p-2 text-left text-sm hover:bg-muted/50"
                      >
                        <FileText className="h-4 w-4 shrink-0" />
                        <span className="min-w-0 flex-1 truncate">{f.file_name}</span>
                        <span className="text-xs text-muted-foreground">{formatBytes(f.file_size)}</span>
                        <Download className="h-4 w-4 text-muted-foreground" />
                      </button>
                    ))}
                  </div>
                </div>
              )}
              <div>
                <Label htmlFor="feedback">Feedback (vizibil pentru elev)</Label>
                <Textarea
                  id="feedback"
                  rows={3}
                  value={feedback}
                  onChange={(e) => setFeedback(e.target.value)}
                  placeholder="Observații, recomandări…"
                />
              </div>
              <div className="space-y-2 rounded-md border p-3">
                <div className="flex items-center gap-2">
                  <Checkbox
                    id="add-portfolio"
                    checked={addToPortfolio}
                    onCheckedChange={(v) => setAddToPortfolio(!!v)}
                  />
                  <Label htmlFor="add-portfolio" className="cursor-pointer font-normal">
                    La aprobare, adaugă în portofoliul elevului
                  </Label>
                </div>
                {addToPortfolio && (
                  <div className="flex items-center gap-2 pl-6">
                    <Checkbox
                      id="pin-item"
                      checked={pinItem}
                      onCheckedChange={(v) => setPinItem(!!v)}
                    />
                    <Label htmlFor="pin-item" className="cursor-pointer font-normal text-sm">
                      <Star className="inline h-3 w-3 mr-1" />
                      Fixează în top
                    </Label>
                  </div>
                )}
              </div>
            </div>
          )}
          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              disabled={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate({ status: "rejected", addItem: false, pin: false })}
            >
              <X className="h-4 w-4 mr-1" /> Respinge
            </Button>
            <Button
              disabled={reviewMutation.isPending}
              onClick={() => reviewMutation.mutate({ status: "approved", addItem: addToPortfolio, pin: pinItem })}
            >
              <Check className="h-4 w-4 mr-1" /> Aprobă
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
