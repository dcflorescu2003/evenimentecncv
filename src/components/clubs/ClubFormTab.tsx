import { useEffect, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Save } from "lucide-react";
import { toast } from "sonner";
import { QuestionsEditor, newQuestion, DraftQuestion } from "@/components/feedback/QuestionsEditor";

interface Props {
  clubId: string;
  canEdit: boolean;
}

export default function ClubFormTab({ clubId, canEdit }: Props) {
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [phoneId, setPhoneId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const { data, refetch } = useQuery({
    queryKey: ["club-form-questions", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_form_questions")
        .select("*")
        .eq("club_id", clubId)
        .order("position");
      if (error) throw error;
      return data ?? [];
    },
  });

  useEffect(() => {
    if (!data) return;
    setQuestions(
      data.map((q: any, i: number) => ({
        tempId: q.id,
        id: q.id,
        position: q.position ?? i,
        question_type: q.question_type,
        text: q.text,
        required: q.required,
        options: Array.isArray(q.options) ? (q.options as string[]) : [],
        scale_min: q.scale_min ?? 1,
        scale_max: q.scale_max ?? 5,
        scale_min_label: q.scale_min_label ?? "",
        scale_max_label: q.scale_max_label ?? "",
      })),
    );
    const phone = data.find((q: any) => q.is_phone);
    setPhoneId(phone?.id ?? null);
  }, [data]);

  async function save() {
    if (questions.some((q) => !q.text.trim())) {
      return toast.error("Toate întrebările trebuie să aibă text");
    }
    setSaving(true);
    const keptIds = questions.filter((q) => q.id).map((q) => q.id!);
    // ștergem întrebările eliminate
    let del = supabase.from("club_form_questions").delete().eq("club_id", clubId);
    if (keptIds.length) del = del.not("id", "in", `(${keptIds.join(",")})`);
    const { error: delErr } = await del;
    if (delErr) { setSaving(false); return toast.error(delErr.message); }

    for (const [i, q] of questions.entries()) {
      const payload = {
        club_id: clubId,
        position: i,
        question_type: q.question_type,
        text: q.text.trim(),
        required: q.required,
        is_phone: !!q.id && q.id === phoneId,
        options: ["single_choice", "multi_choice", "dropdown"].includes(q.question_type)
          ? q.options
          : null,
        scale_min: q.question_type === "scale" ? q.scale_min : null,
        scale_max: q.question_type === "scale" ? q.scale_max : null,
        scale_min_label: q.question_type === "scale" ? q.scale_min_label || null : null,
        scale_max_label: q.question_type === "scale" ? q.scale_max_label || null : null,
      };
      const { error } = q.id
        ? await supabase.from("club_form_questions").update(payload).eq("id", q.id)
        : await supabase.from("club_form_questions").insert(payload);
      if (error) { setSaving(false); return toast.error(error.message); }
    }
    setSaving(false);
    toast.success("Formular salvat");
    refetch();
  }

  if (!canEdit) {
    return (
      <Card>
        <CardContent className="pt-4 text-sm text-muted-foreground">
          {questions.length === 0
            ? "Acest club nu are formular de înscriere."
            : `Formular de înscriere cu ${questions.length} întrebări.`}
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardContent className="space-y-4 pt-4">
        <p className="text-sm text-muted-foreground">
          Dacă adaugi întrebări, elevii trebuie să completeze formularul pentru a trimite cererea de
          înscriere. Lasă lista goală pentru înscriere simplă.
        </p>

        <QuestionsEditor questions={questions} onChange={setQuestions} />

        {questions.some((q) => q.id) && (
          <div className="space-y-2 rounded-lg border p-3">
            <Label className="text-sm">Întrebarea cu numărul de telefon</Label>
            <p className="text-xs text-muted-foreground">
              Bifează întrebarea al cărei răspuns este numărul de telefon; va apărea separat în lista
              de membri. Salvează întâi întrebările noi.
            </p>
            <div className="space-y-1">
              {questions.filter((q) => q.id).map((q) => (
                <label key={q.id} className="flex items-center gap-2 text-sm">
                  <Checkbox
                    checked={phoneId === q.id}
                    onCheckedChange={(v) => setPhoneId(v ? q.id! : null)}
                  />
                  {q.text || "(fără text)"}
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end">
          <Button onClick={save} disabled={saving}>
            <Save className="h-4 w-4 mr-1" />{saving ? "Se salvează…" : "Salvează formularul"}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
