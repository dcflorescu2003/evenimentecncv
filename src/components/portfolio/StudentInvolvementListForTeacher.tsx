import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import {
  involvementTypeLabel, involvementStatusLabel, involvementStatusColor,
} from "@/lib/portfolioInvolvement";

interface Row {
  id: string;
  type: string;
  description: string;
  hours: number | null;
  occurred_on: string | null;
  status: string;
  teacher_note: string | null;
}

export default function StudentInvolvementListForTeacher({ studentId }: { studentId: string }) {
  const { user } = useAuth();

  const { data: rows = [], isLoading } = useQuery({
    queryKey: ["portfolio_involvement_for_student", user?.id, studentId],
    enabled: !!user?.id && !!studentId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("portfolio_involvement")
        .select("id, type, description, hours, occurred_on, status, teacher_note")
        .eq("student_id", studentId)
        .eq("teacher_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return (data ?? []) as Row[];
    },
  });

  if (isLoading) return <p className="text-sm text-muted-foreground">Se încarcă…</p>;
  if (rows.length === 0) {
    return (
      <Card>
        <CardContent className="p-6 text-center text-sm text-muted-foreground">
          Nicio implicare înregistrată pentru acest elev.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-2">
      {rows.map((r) => (
        <Card key={r.id}>
          <CardContent className="p-3">
            <div className="flex flex-wrap items-center gap-x-2 text-xs text-muted-foreground">
              <span className="font-medium text-foreground text-sm">
                {involvementTypeLabel(r.type)}
              </span>
              {r.hours != null && <span>· {r.hours}h</span>}
              {r.occurred_on && (
                <span>· {new Date(r.occurred_on).toLocaleDateString("ro-RO")}</span>
              )}
              <span className={involvementStatusColor(r.status)}>
                · {involvementStatusLabel(r.status)}
              </span>
            </div>
            <p className="text-sm mt-1 whitespace-pre-wrap">{r.description}</p>
            {r.teacher_note && (
              <p className="text-xs text-muted-foreground border-l-2 border-primary/40 pl-2 mt-1">
                {r.teacher_note}
              </p>
            )}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
