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
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandEmpty, CommandItem, CommandGroup } from "@/components/ui/command";
import { cn } from "@/lib/utils";
import { ArrowLeft, Check, ChevronsUpDown, Eye, EyeOff, Send } from "lucide-react";
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

  // All teachers (searchable) for teacher_feedback — via RPC (security definer, bypasses user_roles RLS)
  const { data: allTeachers = [] } = useQuery({
    enabled: form?.type === "teacher_feedback",
    queryKey: ["feedback-all-teachers"],
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_feedback_teachers");
      if (error) throw error;
      return (data ?? [])
        .map((p: any) => ({
          id: p.id,
          name: `${p.last_name ?? ""} ${p.first_name ?? ""}`.trim(),
        }))
        .sort((a, b) => a.name.localeCompare(b.name, "ro"));
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
      const answersArray = Object.entries(answers)
        .filter(([_, v]) => v !== undefined && v !== null && v !== "")
        .map(([qid, v]) => ({ question_id: qid, value: v }));

      const { data, error } = await supabase.rpc("submit_feedback_response", {
        _form_id: form.id,
        _teacher_id: form.type === "teacher_feedback" ? teacherId : null,
        _identified:
          form.anonymity === "identified" ||
          (form.anonymity === "anonymous_optional" && identify),
        _answers: answersArray as any,
        _response_id: existingResponseId,
      });
      if (error) throw error;

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
              <Popover>
                <PopoverTrigger asChild>
                  <Button
                    variant="outline"
                    role="combobox"
                    className="w-full justify-between"
                    disabled={!!existingResponseId}
                  >
                    {teacherId
                      ? allTeachers.find((t: any) => t.id === teacherId)?.name ?? "Alege profesorul…"
                      : "Alege profesorul…"}
                    <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                  </Button>
                </PopoverTrigger>
                <PopoverContent className="w-[--radix-popover-trigger-width] p-0" align="start">
                  <Command>
                    <CommandInput placeholder="Caută profesor..." />
                    <CommandList>
                      <CommandEmpty>Niciun profesor găsit.</CommandEmpty>
                      <CommandGroup>
                        {allTeachers.map((t: any) => (
                          <CommandItem
                            key={t.id}
                            value={t.name}
                            onSelect={() => setTeacherId(t.id)}
                          >
                            <Check className={cn("mr-2 h-4 w-4", teacherId === t.id ? "opacity-100" : "opacity-0")} />
                            {t.name}
                          </CommandItem>
                        ))}
                      </CommandGroup>
                    </CommandList>
                  </Command>
                </PopoverContent>
              </Popover>
              <p className="text-xs text-muted-foreground mt-1">
                Poți răspunde o singură dată per profesor.
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
