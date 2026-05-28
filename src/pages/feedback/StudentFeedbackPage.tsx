import { useMemo } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent } from "@/components/ui/tabs";
import { ArrowRight, Lock, Eye, EyeOff, CheckCircle2 } from "lucide-react";
import { formatDate } from "@/lib/time";

const TYPE_LABEL: Record<string, string> = {
  general: "General",
  teacher_feedback: "Feedback profesori",
  teacher_survey: "Pentru profesori",
};

export default function StudentFeedbackPage() {
  const navigate = useNavigate();
  const { user, roles } = useAuth();
  const [sp] = useSearchParams();
  const tab = sp.get("tab") ?? "dashboard";
  const isTeacherRole = roles.some((r) =>
    ["teacher", "homeroom_teacher", "coordinator_teacher", "cse"].includes(r),
  );

  const { data: forms = [], isLoading } = useQuery({
    enabled: !!user?.id,
    queryKey: ["student-feedback-forms", user?.id, isTeacherRole],
    queryFn: async () => {
      const audience = isTeacherRole ? "teachers" : "students";
      const { data, error } = await supabase
        .from("feedback_forms")
        .select("id, title, description, type, anonymity, status, opens_at, closes_at, audience")
        .eq("audience", audience)
        .in("status", ["active", "closed"])
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: myResponses = [] } = useQuery({
    enabled: !!user?.id,
    queryKey: ["student-feedback-mine", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback_responses")
        .select("id, form_id, submitted_at, is_identified, subject_teacher_id, feedback_forms:form_id (id, title, type, anonymity, closes_at, status)")
        .eq("respondent_id", user!.id)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const { data: myCompletions = [] } = useQuery({
    enabled: !!user?.id,
    queryKey: ["student-feedback-completions", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback_completions")
        .select("id, form_id, completed_at, subject_teacher_id, feedback_forms:form_id (id, title, type, anonymity, closes_at, status)")
        .eq("user_id", user!.id)
        .order("completed_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const respondedKeys = useMemo(() => {
    const s = new Set<string>();
    myCompletions.forEach((r: any) => s.add(`${r.form_id}::${r.subject_teacher_id ?? ""}`));
    return s;
  }, [myCompletions]);

  const now = Date.now();
  const open = forms.filter((f: any) => {
    if (f.status !== "active") return false;
    if (f.closes_at && new Date(f.closes_at).getTime() < now) return false;
    if (f.type === "teacher_feedback") return true; // per-teacher
    return !respondedKeys.has(`${f.id}::`);
  });
  const history = forms.filter((f: any) => !open.includes(f));

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-2xl font-semibold">Feedback</h1>
        <p className="text-sm text-muted-foreground">
          Chestionare deschise, istoric și răspunsurile tale.
        </p>
      </div>

      <Tabs value={tab}>
        {/* === DASHBOARD === */}
        <TabsContent value="dashboard" className="space-y-8 pt-2">
          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Chestionare deschise</h2>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Se încarcă…</p>
            ) : open.length === 0 ? (
              <p className="text-sm text-muted-foreground">Niciun chestionar deschis.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {open.map((f: any) => (
                  <FormCard key={f.id} f={f} onOpen={() => navigate(`/student/feedback/${f.id}/fill`)} />
                ))}
              </div>
            )}
          </section>

          <section className="space-y-3">
            <h2 className="text-lg font-semibold">Istoric</h2>
            {history.length === 0 ? (
              <p className="text-sm text-muted-foreground">Niciun chestionar închis.</p>
            ) : (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {history.map((f: any) => (
                  <FormCard key={f.id} f={f} closed onOpen={() => navigate(`/student/feedback/${f.id}/fill`)} />
                ))}
              </div>
            )}
          </section>
        </TabsContent>

        {/* === FEEDBACKUL MEU === */}
        <TabsContent value="mine" className="space-y-3 pt-2">
          <h2 className="text-lg font-semibold">Răspunsurile mele</h2>
          {(() => {
            const identifiedKeys = new Set(
              myResponses.map((r: any) => `${r.form_id}::${r.subject_teacher_id ?? ""}`),
            );
            const anonCompletions = myCompletions.filter(
              (c: any) => !identifiedKeys.has(`${c.form_id}::${c.subject_teacher_id ?? ""}`),
            );
            const total = myResponses.length + anonCompletions.length;
            if (total === 0) {
              return <p className="text-sm text-muted-foreground">Nu ai răspuns la niciun chestionar.</p>;
            }
            return (
              <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                {myResponses.map((r: any) => {
                  const form = r.feedback_forms;
                  if (!form) return null;
                  const editable =
                    r.is_identified &&
                    form.status === "active" &&
                    (!form.closes_at || new Date(form.closes_at).getTime() > now);
                  return (
                    <Card key={r.id} className="flex flex-col">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{form.title}</CardTitle>
                          {r.is_identified ? (
                            <Badge variant="secondary"><Eye className="h-3 w-3 mr-1" />Identificat</Badge>
                          ) : (
                            <Badge variant="outline"><EyeOff className="h-3 w-3 mr-1" />Anonim</Badge>
                          )}
                        </div>
                        <CardDescription className="text-xs">
                          {TYPE_LABEL[form.type]} • trimis {formatDate(r.submitted_at)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-1 items-end justify-between gap-2">
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-primary" /> Trimis
                        </span>
                        {editable ? (
                          <Button size="sm" variant="outline" onClick={() => navigate(`/student/feedback/${form.id}/fill?response=${r.id}`)}>
                            Editează <ArrowRight className="ml-1 h-3 w-3" />
                          </Button>
                        ) : (
                          <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                            <Lock className="h-3 w-3" /> Final
                          </span>
                        )}
                      </CardContent>
                    </Card>
                  );
                })}
                {anonCompletions.map((c: any) => {
                  const form = c.feedback_forms;
                  if (!form) return null;
                  return (
                    <Card key={c.id} className="flex flex-col">
                      <CardHeader className="pb-2">
                        <div className="flex items-start justify-between gap-2">
                          <CardTitle className="text-base">{form.title}</CardTitle>
                          <Badge variant="outline"><EyeOff className="h-3 w-3 mr-1" />Anonim</Badge>
                        </div>
                        <CardDescription className="text-xs">
                          {TYPE_LABEL[form.type]} • trimis {formatDate(c.completed_at)}
                        </CardDescription>
                      </CardHeader>
                      <CardContent className="flex flex-1 items-end justify-between gap-2">
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-primary" /> Trimis
                        </span>
                        <span className="text-xs text-muted-foreground inline-flex items-center gap-1">
                          <Lock className="h-3 w-3" /> Final
                        </span>
                      </CardContent>
                    </Card>
                  );
                })}
              </div>
            );
          })()}
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FormCard({ f, onOpen, closed }: { f: any; onOpen: () => void; closed?: boolean }) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="pb-2">
        <div className="flex items-start justify-between gap-2">
          <CardTitle className="text-base">{f.title}</CardTitle>
          {f.anonymity === "anonymous" ? (
            <Badge variant="outline"><EyeOff className="h-3 w-3 mr-1" />Anonim</Badge>
          ) : f.anonymity === "identified" ? (
            <Badge variant="secondary"><Eye className="h-3 w-3 mr-1" />Identificat</Badge>
          ) : (
            <Badge variant="outline">Anonim opțional</Badge>
          )}
        </div>
        <CardDescription className="text-xs">
          {TYPE_LABEL[f.type]}
          {f.closes_at && <> • până la {formatDate(f.closes_at)}</>}
        </CardDescription>
      </CardHeader>
      <CardContent className="flex flex-1 flex-col justify-between gap-3">
        <p className="line-clamp-3 text-sm text-muted-foreground">{f.description || "Fără descriere"}</p>
        <Button size="sm" variant={closed ? "outline" : "default"} className="self-end" onClick={onOpen} disabled={closed}>
          {closed ? "Închis" : "Răspunde"} <ArrowRight className="ml-1 h-3 w-3" />
        </Button>
      </CardContent>
    </Card>
  );
}
