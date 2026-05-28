import { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { ArrowLeft, Save } from "lucide-react";
import { toast } from "sonner";
import { DateInput } from "@/components/ui/date-input";
import { ClassEligibilityPicker } from "@/components/clubs/ClassEligibilityPicker";
import { QuestionsEditor, newQuestion, type DraftQuestion, type FbQType } from "@/components/feedback/QuestionsEditor";

type FormType = "general" | "teacher_feedback" | "teacher_survey";
type Anonymity = "anonymous" | "identified" | "anonymous_optional";

interface Props {
  mode: "admin" | "cse" | "teacher";
}

function backBase(mode: Props["mode"]) {
  return mode === "admin" ? "/admin/feedback" : "/prof/feedback";
}

export default function FeedbackEditorPage({ mode }: Props) {
  const { id } = useParams<{ id?: string }>();
  const navigate = useNavigate();
  const { user } = useAuth();
  const isEdit = Boolean(id);

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [type, setType] = useState<FormType>("general");
  const [anonymity, setAnonymity] = useState<Anonymity>("anonymous");
  const [opensAt, setOpensAt] = useState("");
  const [closesAt, setClosesAt] = useState("");
  const [eligibleGrades, setEligibleGrades] = useState<number[]>([]);
  const [eligibleClasses, setEligibleClasses] = useState<string[]>([]);
  const [questions, setQuestions] = useState<DraftQuestion[]>([newQuestion(0)]);
  const [saving, setSaving] = useState(false);

  const { data: activeSession } = useQuery({
    queryKey: ["active-session-feedback"],
    queryFn: async () => {
      const { data } = await supabase
        .from("program_sessions")
        .select("id")
        .eq("status", "active")
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();
      return data;
    },
  });

  useEffect(() => {
    if (!id) return;
    (async () => {
      const { data: form } = await supabase
        .from("feedback_forms")
        .select("*")
        .eq("id", id)
        .maybeSingle();
      if (!form) return;
      setTitle(form.title);
      setDescription(form.description ?? "");
      setType(form.type as FormType);
      setAnonymity(form.anonymity as Anonymity);
      setOpensAt(form.opens_at ? form.opens_at.slice(0, 10) : "");
      setClosesAt(form.closes_at ? form.closes_at.slice(0, 10) : "");
      setEligibleGrades(form.eligible_grades ?? []);
      setEligibleClasses(form.eligible_classes ?? []);

      const { data: qs } = await supabase
        .from("feedback_questions")
        .select("*")
        .eq("form_id", id)
        .order("position");
      if (qs && qs.length) {
        setQuestions(qs.map((q, idx) => ({
          tempId: q.id,
          id: q.id,
          position: q.position ?? idx,
          question_type: q.question_type as FbQType,
          text: q.text,
          required: q.required,
          options: Array.isArray(q.options) ? (q.options as string[]) : [],
          scale_min: q.scale_min ?? 1,
          scale_max: q.scale_max ?? 5,
          scale_min_label: q.scale_min_label ?? "",
          scale_max_label: q.scale_max_label ?? "",
        })));
      }
    })();
  }, [id]);

  const handleSave = async (publish: boolean) => {
    if (!user) return;
    if (!title.trim()) { toast.error("Adaugă un titlu"); return; }
    if (questions.length === 0 || questions.some((q) => !q.text.trim())) {
      toast.error("Toate întrebările trebuie să aibă text"); return;
    }
    if (mode !== "admin" && (type === "teacher_survey" || type === "teacher_feedback")) {
      toast.error("Doar adminul poate crea acest tip de chestionar"); return;
    }

    setSaving(true);
    try {
      const audience: "students" | "teachers" = type === "teacher_survey" ? "teachers" : "students";
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        type,
        anonymity,
        audience,
        status: (publish ? "active" : "draft") as "active" | "draft",
        session_id: activeSession?.id ?? null,
        opens_at: opensAt ? new Date(opensAt + "T00:00:00").toISOString() : null,
        closes_at: closesAt ? new Date(closesAt + "T23:59:59").toISOString() : null,
        eligible_grades: eligibleGrades.length ? eligibleGrades : null,
        eligible_classes: eligibleClasses.length ? eligibleClasses : null,
      };

      let formId = id;
      if (isEdit && id) {
        const { error } = await supabase.from("feedback_forms").update(payload).eq("id", id);
        if (error) throw error;
        await supabase.from("feedback_questions").delete().eq("form_id", id);
      } else {
        const { data, error } = await supabase
          .from("feedback_forms")
          .insert({ ...payload, created_by: user.id, is_cse: mode === "cse" })
          .select("id")
          .single();
        if (error) throw error;
        formId = data.id;
      }

      const qRows = questions.map((q, idx) => ({
        form_id: formId!,
        position: idx,
        question_type: q.question_type,
        text: q.text.trim(),
        required: q.required,
        options: ["single_choice", "multi_choice", "dropdown"].includes(q.question_type) ? q.options : null,
        scale_min: q.question_type === "scale" ? q.scale_min : null,
        scale_max: q.question_type === "scale" ? q.scale_max : null,
        scale_min_label: q.question_type === "scale" ? q.scale_min_label || null : null,
        scale_max_label: q.question_type === "scale" ? q.scale_max_label || null : null,
      }));
      const { error: qErr } = await supabase.from("feedback_questions").insert(qRows);
      if (qErr) throw qErr;

      toast.success(publish ? "Chestionar publicat" : "Salvat ca draft");
      navigate(backBase(mode));
    } catch (e: any) {
      toast.error(e.message ?? "Eroare la salvare");
    } finally {
      setSaving(false);
    }
  };

  const isStudentAudience = type !== "teacher_survey";

  return (
    <div className="max-w-3xl mx-auto space-y-4">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <Button variant="ghost" onClick={() => navigate(backBase(mode))} className="w-full sm:w-auto justify-start">
          <ArrowLeft className="h-4 w-4 mr-2" /> Înapoi
        </Button>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button variant="outline" onClick={() => handleSave(false)} disabled={saving} className="w-full sm:w-auto">
            Salvează draft
          </Button>
          <Button onClick={() => handleSave(true)} disabled={saving} className="w-full sm:w-auto">
            <Save className="h-4 w-4 mr-2" /> Publică
          </Button>
        </div>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>{isEdit ? "Editează chestionarul" : "Chestionar nou"}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label>Titlu</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div>
            <Label>Descriere</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={3} />
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Tip chestionar</Label>
              <Select value={type} onValueChange={(v) => setType(v as FormType)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="general">General (pentru elevi)</SelectItem>
                  {mode === "admin" && <SelectItem value="teacher_feedback">Feedback profesori (elevii aleg profesorul)</SelectItem>}
                  {mode === "admin" && <SelectItem value="teacher_survey">Chestionar pentru profesori</SelectItem>}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Anonimat</Label>
              <Select value={anonymity} onValueChange={(v) => setAnonymity(v as Anonymity)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="anonymous">Anonim</SelectItem>
                  <SelectItem value="anonymous_optional">Anonim (opțional identificat)</SelectItem>
                  <SelectItem value="identified">Identificat</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <Label>Deschidere</Label>
              <DateInput value={opensAt} onChange={setOpensAt} />
            </div>
            <div>
              <Label>Închidere</Label>
              <DateInput value={closesAt} onChange={setClosesAt} />
            </div>
          </div>

          {isStudentAudience && (
            <ClassEligibilityPicker
              eligibleGrades={eligibleGrades}
              eligibleClasses={eligibleClasses}
              onChange={({ eligibleGrades: g, eligibleClasses: c }) => {
                setEligibleGrades(g); setEligibleClasses(c);
              }}
            />
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader><CardTitle>Întrebări</CardTitle></CardHeader>
        <CardContent>
          <QuestionsEditor questions={questions} onChange={setQuestions} />
        </CardContent>
      </Card>
    </div>
  );
}
