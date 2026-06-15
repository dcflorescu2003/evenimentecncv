import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Trophy, FileText, Download } from "lucide-react";
import { toast } from "sonner";
import {
  SIGNUP_STATUS_LABELS, SignupStatus, signupStatusColor,
} from "@/lib/portfolioCompetitions";
import { getPortfolioFileUrl } from "@/lib/portfolio";

export default function StudentCompetitionsListForTeacher({ studentId }: { studentId: string }) {
  const { user } = useAuth();

  const { data: signups = [], isLoading } = useQuery({
    queryKey: ["portfolio_student_competitions_teacher", studentId, user?.id],
    enabled: !!studentId && !!user?.id,
    queryFn: async () => {
      // Only show competitions belonging to this teacher
      const { data: comps } = await supabase
        .from("portfolio_competitions")
        .select("id, title, event_date, type")
        .eq("teacher_id", user!.id);
      const ids = (comps ?? []).map((c) => c.id);
      if (ids.length === 0) return [];
      const compMap = new Map((comps ?? []).map((c: any) => [c.id, c]));
      const { data, error } = await supabase
        .from("portfolio_competition_signups")
        .select("*")
        .eq("student_id", studentId)
        .in("competition_id", ids)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return ((data ?? []) as any[]).map((s) => ({
        ...s,
        competition: compMap.get(s.competition_id),
      }));
    },
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
  if (signups.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Elevul nu participă la niciun concurs (al tău).
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {signups.map((s: any) => (
        <Card key={s.id}>
          <CardContent className="p-4">
            <div className="flex items-start gap-2">
              <Trophy className="h-4 w-4 text-primary mt-0.5 shrink-0" />
              <div className="min-w-0 flex-1">
                <div className="font-medium">{s.competition?.title ?? "—"}</div>
                <div className={`text-xs ${signupStatusColor(s.status as SignupStatus)} mt-1`}>
                  {SIGNUP_STATUS_LABELS[s.status as SignupStatus]}
                  {s.award ? ` · ${s.award}` : ""}
                  {s.score != null ? ` · ${s.score} pct.` : ""}
                </div>
                {s.result && <p className="text-sm mt-1">{s.result}</p>}
                {s.notes && <p className="text-xs text-muted-foreground mt-1 whitespace-pre-wrap">{s.notes}</p>}
                {s.diploma_path && s.diploma_name && (
                  <button type="button"
                    onClick={() => download(s.diploma_path, s.diploma_name)}
                    className="mt-2 flex items-center gap-2 rounded-md border px-2 py-1 text-sm hover:bg-muted/50 w-full">
                    <FileText className="h-4 w-4" />
                    <span className="truncate flex-1 text-left">🏅 {s.diploma_name}</span>
                    <Download className="h-4 w-4 text-muted-foreground" />
                  </button>
                )}
              </div>
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
