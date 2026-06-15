import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { statusColor, statusLabel } from "@/lib/portfolio";

interface Props {
  studentId: string;
}

interface Row {
  assignment_id: string;
  title: string;
  due_date: string | null;
  status: string;
  submitted_at: string | null;
  teacher_feedback: string | null;
}

export default function StudentAssignmentsTab({ studentId }: Props) {
  const { user } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["portfolio_student_assignments", studentId, user?.id],
    enabled: !!studentId && !!user?.id,
    queryFn: async () => {
      const { data: assignments, error: aErr } = await supabase
        .from("portfolio_assignments")
        .select("id, title, due_date, archived")
        .eq("teacher_id", user!.id);
      if (aErr) throw aErr;
      const ids = (assignments ?? []).map((a) => a.id);
      if (ids.length === 0) return [];
      const { data: subs, error: sErr } = await supabase
        .from("portfolio_submissions")
        .select("assignment_id, status, submitted_at, teacher_feedback")
        .eq("student_id", studentId)
        .in("assignment_id", ids);
      if (sErr) throw sErr;
      const subMap = new Map<string, any>();
      for (const s of subs ?? []) subMap.set(s.assignment_id, s);
      return assignments!
        .filter((a) => !a.archived || subMap.has(a.id))
        .map((a) => {
          const s = subMap.get(a.id);
          return {
            assignment_id: a.id,
            title: a.title,
            due_date: a.due_date,
            status: s?.status ?? "not_submitted",
            submitted_at: s?.submitted_at ?? null,
            teacher_feedback: s?.teacher_feedback ?? null,
          } as Row;
        });
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Se încarcă…</p>;
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Nu ai creat încă teme.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Card key={r.assignment_id}>
          <CardContent className="p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="font-medium">{r.title}</div>
              <span className={`text-sm ${statusColor(r.status)}`}>
                {r.status === "not_submitted" ? "Netrimis" : statusLabel(r.status)}
              </span>
            </div>
            <div className="text-xs text-muted-foreground mt-1 flex flex-wrap gap-x-3">
              {r.due_date && (
                <span>
                  Termen:{" "}
                  {new Date(r.due_date).toLocaleDateString("ro-RO", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                  })}
                </span>
              )}
              {r.submitted_at && (
                <span>
                  Trimis:{" "}
                  {new Date(r.submitted_at).toLocaleDateString("ro-RO", {
                    day: "2-digit", month: "2-digit", year: "numeric",
                  })}
                </span>
              )}
            </div>
            {r.teacher_feedback && (
              <p className="mt-2 text-sm whitespace-pre-wrap text-muted-foreground border-l-2 border-primary/40 pl-2">
                {r.teacher_feedback}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
