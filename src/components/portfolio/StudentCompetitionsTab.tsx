import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Trophy, FileText, Download, Check, X } from "lucide-react";
import { toast } from "sonner";
import {
  COMPETITION_TYPE_LABELS, COMPETITION_DIFFICULTY_LABELS, COMPETITION_TEAM_LABELS,
  SIGNUP_STATUS_LABELS, SignupStatus, signupStatusColor,
} from "@/lib/portfolioCompetitions";
import { getPortfolioFileUrl } from "@/lib/portfolio";

interface CompetitionWithSignup {
  id: string;
  title: string;
  description: string | null;
  type: string;
  difficulty: string;
  team_mode: string;
  location: string | null;
  event_date: string | null;
  signup_deadline: string | null;
  regulation_url: string | null;
  teacher_id: string;
  teacher: { first_name: string; last_name: string } | null;
  signup: {
    id: string;
    status: SignupStatus;
    result: string | null;
    award: string | null;
    notes: string | null;
    diploma_path: string | null;
    diploma_name: string | null;
  } | null;
}

export default function StudentCompetitionsTab() {
  const { user } = useAuth();
  const qc = useQueryClient();

  const { data: list = [], isLoading } = useQuery({
    queryKey: ["student_competitions", user?.id],
    enabled: !!user?.id,
    queryFn: async () => {
      // Get classes the student is in
      const { data: classAssigns, error: caErr } = await supabase
        .from("student_class_assignments")
        .select("class_id")
        .eq("student_id", user!.id);
      if (caErr) throw caErr;
      const classIds = (classAssigns ?? []).map((c) => c.class_id);
      if (classIds.length === 0) return [];

      // Get all active competitions that target one of the student's classes
      const { data: comps, error: cErr } = await supabase
        .from("portfolio_competitions")
        .select("*")
        .eq("status", "active")
        .overlaps("class_ids", classIds)
        .order("created_at", { ascending: false });
      if (cErr) throw cErr;
      const competitions = (comps ?? []) as any[];
      if (competitions.length === 0) return [];

      const teacherIds = Array.from(new Set(competitions.map((c) => c.teacher_id)));
      const compIds = competitions.map((c) => c.id);

      const [teachersRes, signupsRes] = await Promise.all([
        supabase.from("profiles").select("id, first_name, last_name").in("id", teacherIds),
        supabase
          .from("portfolio_competition_signups")
          .select("id, competition_id, status, result, award, notes, diploma_path, diploma_name")
          .eq("student_id", user!.id)
          .in("competition_id", compIds),
      ]);
      const tMap = new Map((teachersRes.data ?? []).map((t: any) => [t.id, t]));
      const sMap = new Map((signupsRes.data ?? []).map((s: any) => [s.competition_id, s]));

      return competitions.map((c) => ({
        ...c,
        teacher: tMap.get(c.teacher_id) ?? null,
        signup: sMap.get(c.id) ?? null,
      })) as CompetitionWithSignup[];
    },
  });

  const expressInterest = useMutation({
    mutationFn: async (competitionId: string) => {
      const { error } = await supabase.from("portfolio_competition_signups").insert({
        competition_id: competitionId,
        student_id: user!.id,
        status: "interested",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student_competitions", user?.id] });
      toast.success("Interes înregistrat. Profesorul te va contacta.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const withdraw = useMutation({
    mutationFn: async (signupId: string) => {
      const { error } = await supabase
        .from("portfolio_competition_signups")
        .delete()
        .eq("id", signupId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["student_competitions", user?.id] });
      toast.success("Interes retras");
    },
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

  if (isLoading) return <p className="text-sm text-muted-foreground">Se încarcă…</p>;
  if (list.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Niciun concurs disponibil în acest moment.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {list.map((c) => {
        const canInterest = !c.signup;
        const canWithdraw = c.signup?.status === "interested";
        return (
          <Card key={c.id}>
            <CardContent className="p-4 space-y-2">
              <div className="flex items-start gap-2">
                <Trophy className="h-5 w-5 text-primary shrink-0 mt-0.5" />
                <div className="min-w-0 flex-1">
                  <div className="font-medium">{c.title}</div>
                  <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3 gap-y-1">
                    <span>{COMPETITION_TYPE_LABELS[c.type as keyof typeof COMPETITION_TYPE_LABELS]}</span>
                    <span>{COMPETITION_DIFFICULTY_LABELS[c.difficulty as keyof typeof COMPETITION_DIFFICULTY_LABELS]}</span>
                    <span>{COMPETITION_TEAM_LABELS[c.team_mode as keyof typeof COMPETITION_TEAM_LABELS]}</span>
                    {c.teacher && <span>{c.teacher.last_name} {c.teacher.first_name}</span>}
                    {c.event_date && <span>Concurs: {new Date(c.event_date).toLocaleDateString("ro-RO")}</span>}
                    {c.signup_deadline && <span>Înscriere până: {new Date(c.signup_deadline).toLocaleDateString("ro-RO")}</span>}
                    {c.location && <span>📍 {c.location}</span>}
                  </div>
                </div>
              </div>
              {c.description && (
                <p className="text-sm whitespace-pre-wrap text-muted-foreground">{c.description}</p>
              )}
              {c.regulation_url && (
                <a href={c.regulation_url} target="_blank" rel="noopener noreferrer"
                   className="text-sm text-primary underline">Vezi regulament</a>
              )}

              {c.signup ? (
                <div className="rounded-md border p-2 space-y-1">
                  <div className={`text-sm font-medium ${signupStatusColor(c.signup.status)}`}>
                    Status: {SIGNUP_STATUS_LABELS[c.signup.status]}
                    {c.signup.award ? ` · ${c.signup.award}` : ""}
                  </div>
                  {c.signup.result && (
                    <p className="text-sm">{c.signup.result}</p>
                  )}
                  {c.signup.notes && (
                    <p className="text-xs text-muted-foreground whitespace-pre-wrap">{c.signup.notes}</p>
                  )}
                  {c.signup.diploma_path && c.signup.diploma_name && (
                    <button type="button"
                      onClick={() => download(c.signup!.diploma_path!, c.signup!.diploma_name!)}
                      className="mt-1 flex items-center gap-2 rounded-md border px-2 py-1 text-sm hover:bg-muted/50 w-full">
                      <FileText className="h-4 w-4" />
                      <span className="truncate flex-1 text-left">🏅 {c.signup.diploma_name}</span>
                      <Download className="h-4 w-4 text-muted-foreground" />
                    </button>
                  )}
                  {canWithdraw && (
                    <Button variant="ghost" size="sm" className="text-destructive"
                      onClick={() => withdraw.mutate(c.signup!.id)}>
                      <X className="h-4 w-4 mr-1" /> Retrag interesul
                    </Button>
                  )}
                </div>
              ) : canInterest ? (
                <Button size="sm" onClick={() => expressInterest.mutate(c.id)}
                  disabled={expressInterest.isPending}>
                  <Check className="h-4 w-4 mr-1" /> Mă interesează
                </Button>
              ) : null}
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
