import { useMemo } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ArrowLeft, FileDown } from "lucide-react";
import { formatDate } from "@/lib/time";
import { exportFeedbackReportPdf, type FbQuestion, type FbResponse } from "@/lib/feedback-pdf";

interface Props {
  mode: "admin" | "cse" | "teacher";
}

export default function FeedbackReportPage({ mode }: Props) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const base = mode === "admin" ? "/admin/feedback" : "/prof/feedback";

  const { data: form } = useQuery({
    enabled: !!id,
    queryKey: ["fb-report-form", id],
    queryFn: async () => {
      const { data, error } = await supabase.from("feedback_forms").select("*").eq("id", id!).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: questions = [] } = useQuery<FbQuestion[]>({
    enabled: !!id,
    queryKey: ["fb-report-questions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback_questions").select("*").eq("form_id", id!).order("position");
      if (error) throw error;
      return (data ?? []).map((q: any) => ({
        id: q.id, position: q.position, question_type: q.question_type, text: q.text,
        options: Array.isArray(q.options) ? q.options : null,
        scale_min: q.scale_min, scale_max: q.scale_max,
      }));
    },
  });

  const { data: responses = [] } = useQuery<FbResponse[]>({
    enabled: !!id,
    queryKey: ["fb-report-responses", id],
    queryFn: async () => {
      const { data: resp, error } = await supabase
        .from("feedback_responses")
        .select("id, submitted_at, is_identified, respondent_id, subject_teacher_id")
        .eq("form_id", id!)
        .order("submitted_at", { ascending: false });
      if (error) throw error;
      const ids = (resp ?? []).map((r: any) => r.id);
      const { data: ans } = ids.length
        ? await supabase.from("feedback_answers").select("response_id, question_id, value").in("response_id", ids)
        : { data: [] as any[] };
      const byResp = new Map<string, any[]>();
      (ans ?? []).forEach((a: any) => {
        if (!byResp.has(a.response_id)) byResp.set(a.response_id, []);
        byResp.get(a.response_id)!.push({ question_id: a.question_id, value: a.value });
      });

      // Fetch respondent + teacher names separately (no FK -> can't embed via PostgREST)
      const respondentIds = Array.from(
        new Set(
          (resp ?? [])
            .filter((r: any) => r.is_identified && r.respondent_id)
            .map((r: any) => r.respondent_id as string)
        )
      );
      const teacherIds = Array.from(
        new Set((resp ?? []).map((r: any) => r.subject_teacher_id).filter(Boolean) as string[])
      );
      const allIds = Array.from(new Set([...respondentIds, ...teacherIds]));
      const nameMap = new Map<string, string>();
      if (allIds.length) {
        const { data: profs } = await supabase
          .from("profiles")
          .select("id, first_name, last_name")
          .in("id", allIds);
        (profs ?? []).forEach((p: any) => {
          nameMap.set(p.id, `${p.last_name ?? ""} ${p.first_name ?? ""}`.trim());
        });
      }

      return (resp ?? []).map((r: any) => ({
        id: r.id,
        submitted_at: r.submitted_at,
        is_identified: r.is_identified,
        respondent_name: r.is_identified && r.respondent_id ? nameMap.get(r.respondent_id) ?? null : null,
        subject_teacher_id: r.subject_teacher_id ?? null,
        subject_teacher_name: r.subject_teacher_id ? nameMap.get(r.subject_teacher_id) ?? null : null,
        answers: byResp.get(r.id) ?? [],
      }));
    },
  });

  const qMap = useMemo(() => new Map(questions.map((q) => [q.id, q])), [questions]);

  const isTeacherFeedback = form?.type === "teacher_feedback";

  const groups = useMemo(() => {
    if (!isTeacherFeedback) {
      return [{ key: "__all__", label: "Toate răspunsurile", responses }];
    }
    const map = new Map<string, { key: string; label: string; responses: FbResponse[] }>();
    responses.forEach((r) => {
      const key = r.subject_teacher_id ?? "__none__";
      const label = r.subject_teacher_name ?? "Profesor neselectat";
      if (!map.has(key)) map.set(key, { key, label, responses: [] });
      map.get(key)!.responses.push(r);
    });
    return Array.from(map.values()).sort((a, b) => a.label.localeCompare(b.label, "ro"));
  }, [responses, isTeacherFeedback]);

  const handleExport = () => {
    if (!form) return;
    exportFeedbackReportPdf({
      title: form.title,
      subtitle: form.description ?? undefined,
      questions,
      responses,
    });
  };

  if (!form) return <p className="text-sm text-muted-foreground">Se încarcă…</p>;

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      <div className="flex items-center justify-between">
        <Button variant="ghost" onClick={() => navigate(base)}>
          <ArrowLeft className="h-4 w-4 mr-2" /> Înapoi
        </Button>
        <Button onClick={handleExport}>
          <FileDown className="h-4 w-4 mr-2" /> Export PDF
        </Button>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{form.title}</CardTitle>
          <CardDescription>
            {responses.length} răspunsuri • {form.anonymity === "anonymous" ? "Anonim" : form.anonymity === "identified" ? "Identificat" : "Anonim opțional"}
          </CardDescription>
        </CardHeader>
      </Card>

      {groups.map((g) => (
        <div key={g.key} className="space-y-4">
          {isTeacherFeedback && (
            <div className="flex items-center gap-2 pt-2">
              <h2 className="text-lg font-semibold">{g.label}</h2>
              <Badge variant="secondary">{g.responses.length} răspunsuri</Badge>
            </div>
          )}

          <Card>
            <CardHeader><CardTitle className="text-base">Rezultate agregate</CardTitle></CardHeader>
            <CardContent className="space-y-6">
              {questions.map((q, idx) => (
                <AggregateBlock key={q.id} q={q} idx={idx} responses={g.responses} />
              ))}
            </CardContent>
          </Card>

          <Card>
            <CardHeader><CardTitle className="text-base">Răspunsuri individuale</CardTitle></CardHeader>
            <CardContent className="space-y-3">
              {g.responses.length === 0 && <p className="text-sm text-muted-foreground">Niciun răspuns încă.</p>}
              {g.responses.map((r) => (
                <div key={r.id} className="border rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <div className="text-sm">
                      {r.is_identified
                        ? <strong>{r.respondent_name ?? "Identificat"}</strong>
                        : <span className="text-muted-foreground">Anonim</span>}
                      {isTeacherFeedback && r.subject_teacher_name && (
                        <span className="text-muted-foreground"> • despre {r.subject_teacher_name}</span>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground">{formatDate(r.submitted_at)}</div>
                  </div>
                  <div className="space-y-1 text-sm">
                    {r.answers.map((a) => {
                      const q = qMap.get(a.question_id);
                      if (!q) return null;
                      return (
                        <div key={a.question_id}>
                          <span className="text-muted-foreground">{q.text}: </span>
                          <span>{formatValue(a.value)}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>
      ))}
    </div>
  );
}

function formatValue(v: unknown): string {
  if (v === null || v === undefined) return "—";
  if (Array.isArray(v)) return v.join(", ");
  return String(v);
}

function AggregateBlock({ q, idx, responses }: { q: FbQuestion; idx: number; responses: FbResponse[] }) {
  const values = responses
    .map((r) => r.answers.find((a) => a.question_id === q.id)?.value)
    .filter((v) => v !== undefined && v !== null);

  return (
    <div className="space-y-2">
      <div className="font-medium">{idx + 1}. {q.text}</div>
      {q.question_type === "scale" ? (
        <ScaleStats values={values} min={q.scale_min ?? 1} max={q.scale_max ?? 5} />
      ) : q.question_type === "open_text" ? (
        <div className="space-y-1">
          {values.length === 0 && <span className="text-sm text-muted-foreground">Fără răspunsuri.</span>}
          {values.map((v, i) => <div key={i} className="text-sm border-l-2 pl-2 border-primary/40">{String(v)}</div>)}
        </div>
      ) : (
        <ChoiceStats values={values} options={q.options ?? []} total={responses.length} />
      )}
    </div>
  );
}

function ChoiceStats({ values, options, total }: { values: unknown[]; options: string[]; total: number }) {
  const counts: Record<string, number> = {};
  values.forEach((v) => {
    const arr = Array.isArray(v) ? v : [v];
    arr.forEach((x) => {
      const k = String(x ?? "");
      counts[k] = (counts[k] ?? 0) + 1;
    });
  });
  const keys = options.length ? options : Object.keys(counts);
  return (
    <div className="space-y-1">
      {keys.map((k) => {
        const c = counts[k] ?? 0;
        const pct = total ? (c / total) * 100 : 0;
        return (
          <div key={k} className="space-y-1">
            <div className="flex justify-between text-sm">
              <span>{k}</span>
              <span className="text-muted-foreground">{c} ({pct.toFixed(0)}%)</span>
            </div>
            <div className="h-2 rounded bg-muted overflow-hidden">
              <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function ScaleStats({ values, min, max }: { values: unknown[]; min: number; max: number }) {
  const nums = values.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
  if (!nums.length) return <span className="text-sm text-muted-foreground">Fără răspunsuri.</span>;
  const sum = nums.reduce((a, b) => a + b, 0);
  const sorted = [...nums].sort((a, b) => a - b);
  const median = sorted.length % 2 ? sorted[(sorted.length - 1) / 2]
    : (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2;
  const dist: Record<number, number> = {};
  for (let i = min; i <= max; i++) dist[i] = 0;
  nums.forEach((n) => { dist[n] = (dist[n] ?? 0) + 1; });
  return (
    <div className="space-y-2">
      <div className="text-sm text-muted-foreground">
        n={nums.length} • medie={(sum / nums.length).toFixed(2)} • mediană={median}
      </div>
      <div className="space-y-1">
        {Object.entries(dist).map(([k, c]) => {
          const pct = nums.length ? (c / nums.length) * 100 : 0;
          return (
            <div key={k} className="space-y-1">
              <div className="flex justify-between text-sm">
                <span>Scor {k}</span>
                <span className="text-muted-foreground">{c} ({pct.toFixed(0)}%)</span>
              </div>
              <div className="h-2 rounded bg-muted overflow-hidden">
                <div className="h-full bg-primary" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
