import { useEffect, useMemo, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Eye, EyeOff, Send } from "lucide-react";
import { toast } from "sonner";
import { QuestionRenderer, type RenderQuestion } from "@/components/feedback/QuestionRenderer";

export default function FeedbackFillPage() {
  const { id } = useParams<{ id: string }>();
  const [sp] = useSearchParams();
  const responseIdParam = sp.get("response");
  const navigate = useNavigate();
  const { user } = useAuth();

  const [teacherId, setTeacherId] = useState<string>("");
  const [identify, setIdentify] = useState(false); // for anonymous_optional
  const [answers, setAnswers] = useState<Record<string, unknown>>({});
  const [submitting, setSubmitting] = useState(false);
  const [existingResponseId, setExistingResponseId] = useState<string | null>(null);

  const { data: form } = useQuery({
    enabled: !!id,
    queryKey: ["feedback-form-fill", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback_forms")
        .select("*")
        .eq("id", id!)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const { data: questions = [] } = useQuery<RenderQuestion[]>({
    enabled: !!id,
    queryKey: ["feedback-form-questions", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("feedback_questions")
        .select("*")
        .eq("form_id", id!)
        .order("position");
      if (error) throw error;
      return (data ?? []).map((q: any) => ({
        ...q,
        options: Array.isArray(q.options) ? q.options : null,
      }));
    },
  });

  // Class teachers (for teacher_feedback): map schedule_entries.teacher_name (initials) -> profile by initials
  const { data: classTeachers = [] } = useQuery({
    enabled: !!user?.id && form?.type === "teacher_feedback",
    queryKey: ["class-teachers", user?.id],
    queryFn: async () => {
      const { data: cls } = await supabase
        .from("student_class_assignments")
        .select("class_id")
        .eq("student_id", user!.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (!cls?.class_id) return [];
      const { data: schedules } = await supabase
        .from("class_schedules")
        .select("id")
        .eq("class_id", cls.class_id);
      const scheduleIds = (schedules ?? []).map((s: any) => s.id);
      if (!scheduleIds.length) return [];
      const { data: entries } = await supabase
        .from("schedule_entries")
        .select("teacher_name, subject")
        .in("schedule_id", scheduleIds);
      const initials = Array.from(
        new Set((entries ?? []).map((e: any) => (e.teacher_name ?? "").trim()).filter(Boolean)),
      );
      if (!initials.length) return [];
      const { data: profs } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, initials")
        .in("initials", initials);
      const subjectByInit = new Map<string, Set<string>>();
      (entries ?? []).forEach((e: any) => {
        const k = (e.teacher_name ?? "").trim();
        if (!k) return;
        if (!subjectByInit.has(k)) subjectByInit.set(k, new Set());
        if (e.subject) subjectByInit.get(k)!.add(e.subject);
      });
      return (profs ?? []).map((p: any) => ({
        id: p.id,
        name: `${p.last_name ?? ""} ${p.first_name ?? ""}`.trim(),
        subjects: Array.from(subjectByInit.get(p.initials) ?? []).join(", "),
      })).sort((a, b) => a.name.localeCompare(b.name, "ro"));
    },
  });

  // Load existing answers when editing
  useEffect(() => {
    if (!responseIdParam || !id || !user?.id) return;
    (async () => {
      const { data: resp } = await supabase
        .from("feedback_responses")
        .select("id, subject_teacher_id, is_identified")
        .eq("id", responseIdParam)
        .eq("respondent_id", user.id)
        .maybeSingle();
      if (!resp) return;
      setExistingResponseId(resp.id);
      setTeacherId(resp.subject_teacher_id ?? "");
      setIdentify(resp.is_identified);
      const { data: ans } = await supabase
        .from("feedback_answers")
        .select("question_id, value")
        .eq("response_id", resp.id);
      const map: Record<string, unknown> = {};
      (ans ?? []).forEach((a: any) => { map[a.question_id] = a.value; });
      setAnswers(map);
    })();
  }, [responseIdParam, id, user?.id]);

  const anonymityNotice = useMemo(() => {
    if (!form) return "";
    if (form.anonymity === "anonymous") return "Acest chestionar este complet anonim — nu se înregistrează identitatea ta.";
    if (form.anonymity === "identified") return "Răspunsurile la acest chestionar sunt asociate identității tale.";
    return "Răspunsul este anonim implicit. Poți alege să fii identificat (vei putea edita ulterior).";
  }, [form]);

  const willBeIdentified =
    form?.anonymity === "identified" || (form?.anonymity === "anonymous_optional" && identify);

  const handleSubmit = async () => {
    if (!form || !user) return;
    if (form.type === "teacher_feedback" && !teacherId) {
      toast.error("Selectează un profesor"); return;
    }
    for (const q of questions) {
      if (q.required) {
        const v = answers[q.id];
        if (v === undefined || v === null || v === "" || (Array.isArray(v) && v.length === 0)) {
          toast.error(`Răspunde la întrebarea: ${q.text}`); return;
        }
      }
    }

    setSubmitting(true);
    try {
      // Eligibility / anti-duplicate via RPC (skip when editing)
      if (!existingResponseId) {
        const { data: check } = await supabase.rpc("check_feedback_submission", {
          _user_id: user.id,
          _form_id: form.id,
          _teacher_id: form.type === "teacher_feedback" ? teacherId : null,
        });
        if (check && !(check as any).allowed) {
          toast.error((check as any).reason ?? "Nu poți trimite acest răspuns");
          setSubmitting(false); return;
        }
      }

      const isAnonymous = form.anonymity === "anonymous" || (form.anonymity === "anonymous_optional" && !identify);

      let responseId = existingResponseId;
      if (responseId) {
        const { error } = await supabase
          .from("feedback_responses")
          .update({ is_identified: !isAnonymous, updated_at: new Date().toISOString() })
          .eq("id", responseId);
        if (error) throw error;
        await supabase.from("feedback_answers").delete().eq("response_id", responseId);
      } else {
        const { data, error } = await supabase
          .from("feedback_responses")
          .insert({
            form_id: form.id,
            respondent_id: isAnonymous ? null : user.id,
            subject_teacher_id: form.type === "teacher_feedback" ? teacherId : null,
            is_identified: !isAnonymous,
          })
          .select("id")
          .single();
        if (error) throw error;
        responseId = data.id;
      }

      const rows = Object.entries(answers)
        .filter(([_, v]) => v !== undefined && v !== null && v !== "")
        .map(([qid, v]) => ({ response_id: responseId!, question_id: qid, value: v as any }));
      if (rows.length) {
        const { error } = await supabase.from("feedback_answers").insert(rows);
        if (error) throw error;
      }

      toast.success("Răspunsul a fost trimis");
      navigate(-1);
    } catch (e: any) {
      toast.error(e.message ?? "Eroare la trimitere");
    } finally {
      setSubmitting(false);
    }
  };

  if (!form) return <p className="text-sm text-muted-foreground">Se încarcă…</p>;

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <Button variant="ghost" onClick={() => navigate(-1)}>
        <ArrowLeft className="h-4 w-4 mr-2" /> Înapoi
      </Button>

      <Card>
        <CardHeader>
          <CardTitle>{form.title}</CardTitle>
          {form.description && <CardDescription>{form.description}</CardDescription>}
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            {willBeIdentified ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
            <AlertDescription>{anonymityNotice}</AlertDescription>
          </Alert>

          {form.anonymity === "anonymous_optional" && (
            <label className="flex items-center gap-2 cursor-pointer">
              <Checkbox checked={identify} onCheckedChange={(v) => setIdentify(Boolean(v))} />
              <span className="text-sm">Vreau să fiu identificat (voi putea edita răspunsul ulterior)</span>
            </label>
          )}

          {form.type === "teacher_feedback" && (
            <div>
              <Label>Profesor</Label>
              <Select value={teacherId} onValueChange={setTeacherId} disabled={!!existingResponseId}>
                <SelectTrigger><SelectValue placeholder="Alege profesorul…" /></SelectTrigger>
                <SelectContent>
                  {classTeachers.length === 0 && (
                    <div className="px-2 py-3 text-sm text-muted-foreground">
                      Niciun profesor disponibil din orar.
                    </div>
                  )}
                  {classTeachers.map((t: any) => (
                    <SelectItem key={t.id} value={t.id}>
                      {t.name}{t.subjects ? ` — ${t.subjects}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-muted-foreground mt-1">
                Vezi doar profesorii din orarul clasei tale. Poți răspunde o singură dată per profesor.
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      <div className="space-y-3">
        {questions.map((q, i) => (
          <QuestionRenderer
            key={q.id}
            question={q}
            index={i}
            value={answers[q.id]}
            onChange={(v) => setAnswers((s) => ({ ...s, [q.id]: v }))}
          />
        ))}
      </div>

      <div className="flex justify-end">
        <Button onClick={handleSubmit} disabled={submitting}>
          <Send className="h-4 w-4 mr-2" /> {existingResponseId ? "Actualizează" : "Trimite"}
        </Button>
      </div>
    </div>
  );
}
