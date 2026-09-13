import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter,
} from "@/components/ui/dialog";
import { toast } from "sonner";
import { QuestionRenderer, RenderQuestion } from "@/components/feedback/QuestionRenderer";

export function useClubQuestions(clubId: string) {
  return useQuery({
    queryKey: ["club-form-questions-public", clubId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("club_form_questions")
        .select("id, position, question_type, text, required, options, scale_min, scale_max, scale_min_label, scale_max_label, is_phone")
        .eq("club_id", clubId)
        .order("position");
      if (error) throw error;
      return (data ?? []) as any[];
    },
  });
}

export default function ClubEnrollDialog({
  clubId, disabled,
}: {
  clubId: string;
  disabled?: boolean;
}) {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [values, setValues] = useState<Record<string, unknown>>({});
  const [busy, setBusy] = useState(false);
  const { data: questions = [] } = useClubQuestions(clubId);

  async function submit(answers: Record<string, unknown>) {
    setBusy(true);
    const { error } = await supabase.rpc("submit_club_enrollment", {
      _club_id: clubId,
      _answers: answers as any,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success("Cererea ta a fost trimisă. Vei fi înscris după aprobare.");
    setOpen(false);
    setValues({});
    qc.invalidateQueries({ queryKey: ["club-enrollments", clubId] });
    qc.invalidateQueries({ queryKey: ["club-my-enrollment", clubId] });
  }

  if (questions.length === 0) {
    return (
      <Button size="sm" disabled={disabled || busy} onClick={() => submit({})}>
        Înscrie-mă
      </Button>
    );
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" disabled={disabled} onClick={() => setOpen(true)}>
        Completează formularul
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>Formular de înscriere</DialogTitle></DialogHeader>
        <div className="space-y-3">
          {questions.map((q: any, i: number) => (
            <QuestionRenderer
              key={q.id}
              index={i}
              question={q as RenderQuestion}
              value={values[q.id]}
              onChange={(v) => setValues((prev) => ({ ...prev, [q.id]: v }))}
            />
          ))}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => setOpen(false)}>Anulează</Button>
          <Button disabled={busy} onClick={() => submit(values)}>
            {busy ? "Se trimite…" : "Trimite cererea"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
