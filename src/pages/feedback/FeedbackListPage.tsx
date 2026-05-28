import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Plus, BarChart3, Pencil, Trash2, Power, PowerOff } from "lucide-react";
import { toast } from "sonner";
import { formatDate } from "@/lib/time";

interface Props {
  mode: "admin" | "cse" | "teacher";
}

const TYPE_LABEL: Record<string, string> = {
  general: "General",
  teacher_feedback: "Feedback profesori",
  teacher_survey: "Pentru profesori",
};

const STATUS_LABEL: Record<string, string> = {
  draft: "Draft",
  active: "Activ",
  closed: "Închis",
};

export default function FeedbackListPage({ mode }: Props) {
  const navigate = useNavigate();
  const { user } = useAuth();
  const qc = useQueryClient();
  const base = mode === "admin" ? "/admin/feedback" : "/prof/feedback";

  const { data: forms = [], isLoading } = useQuery({
    enabled: !!user?.id,
    queryKey: ["feedback-forms", mode, user?.id],
    queryFn: async () => {
      let q = supabase
        .from("feedback_forms")
        .select("id, title, description, type, anonymity, status, opens_at, closes_at, created_at, created_by")
        .order("created_at", { ascending: false });
      if (mode !== "admin") q = q.eq("created_by", user!.id);
      const { data, error } = await q;
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleStatus = async (id: string, status: "active" | "closed" | "draft") => {
    const { error } = await supabase.from("feedback_forms").update({ status }).eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Status actualizat");
    qc.invalidateQueries({ queryKey: ["feedback-forms"] });
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Sigur ștergi chestionarul și toate răspunsurile?")) return;
    const { error } = await supabase.from("feedback_forms").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    toast.success("Șters");
    qc.invalidateQueries({ queryKey: ["feedback-forms"] });
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-semibold">Feedback</h1>
          <p className="text-sm text-muted-foreground">Chestionarele tale și rapoartele lor.</p>
        </div>
        <Button onClick={() => navigate(`${base}/new`)}>
          <Plus className="h-4 w-4 mr-2" /> Chestionar nou
        </Button>
      </div>

      {isLoading ? (
        <p className="text-sm text-muted-foreground">Se încarcă…</p>
      ) : forms.length === 0 ? (
        <p className="text-sm text-muted-foreground">Niciun chestionar creat.</p>
      ) : (
        <div className="grid gap-3 md:grid-cols-2">
          {forms.map((f: any) => (
            <Card key={f.id} className="flex flex-col">
              <CardHeader className="pb-2">
                <div className="flex items-start justify-between gap-2">
                  <CardTitle className="text-base">{f.title}</CardTitle>
                  <Badge variant={f.status === "active" ? "default" : "secondary"}>
                    {STATUS_LABEL[f.status]}
                  </Badge>
                </div>
                <CardDescription className="text-xs">
                  {TYPE_LABEL[f.type]} • {f.anonymity === "anonymous" ? "Anonim" : f.anonymity === "identified" ? "Identificat" : "Anonim opțional"}
                  {f.closes_at && <> • până la {formatDate(f.closes_at)}</>}
                </CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col justify-end gap-2">
                {f.description && <p className="line-clamp-2 text-sm text-muted-foreground">{f.description}</p>}
                <div className="flex flex-wrap gap-2 justify-end">
                  <Button size="sm" variant="outline" onClick={() => navigate(`${base}/${f.id}/report`)}>
                    <BarChart3 className="h-3 w-3 mr-1" /> Raport
                  </Button>
                  <Button size="sm" variant="outline" onClick={() => navigate(`${base}/${f.id}/edit`)}>
                    <Pencil className="h-3 w-3 mr-1" /> Editează
                  </Button>
                  {f.status === "draft" && (
                    <Button size="sm" variant="outline" onClick={() => handleStatus(f.id, "active")}>
                      <Power className="h-3 w-3 mr-1" /> Publică
                    </Button>
                  )}
                  {f.status === "active" && (
                    <Button size="sm" variant="outline" onClick={() => handleStatus(f.id, "closed")}>
                      <PowerOff className="h-3 w-3 mr-1" /> Închide
                    </Button>
                  )}
                  {f.status === "closed" && (
                    <Button size="sm" variant="outline" onClick={() => handleStatus(f.id, "active")}>
                      <Power className="h-3 w-3 mr-1" /> Redeschide
                    </Button>
                  )}
                  <Button size="sm" variant="ghost" onClick={() => handleDelete(f.id)}>
                    <Trash2 className="h-3 w-3 text-destructive" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
