import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Trash2, Plus, GripVertical, ArrowUp, ArrowDown } from "lucide-react";

export type FbQType = "single_choice" | "multi_choice" | "dropdown" | "scale" | "open_text";

export interface DraftQuestion {
  tempId: string;
  id?: string;
  position: number;
  question_type: FbQType;
  text: string;
  required: boolean;
  options: string[];
  scale_min: number;
  scale_max: number;
  scale_min_label: string;
  scale_max_label: string;
}

const TYPE_LABEL: Record<FbQType, string> = {
  single_choice: "O singură variantă",
  multi_choice: "Variante multiple",
  dropdown: "Listă dropdown",
  scale: "Scară numerică",
  open_text: "Răspuns deschis",
};

export function newQuestion(position: number): DraftQuestion {
  return {
    tempId: `q-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
    position,
    question_type: "single_choice",
    text: "",
    required: false,
    options: ["Opțiune 1", "Opțiune 2"],
    scale_min: 1,
    scale_max: 5,
    scale_min_label: "",
    scale_max_label: "",
  };
}

interface Props {
  questions: DraftQuestion[];
  onChange: (qs: DraftQuestion[]) => void;
}

export function QuestionsEditor({ questions, onChange }: Props) {
  const update = (i: number, patch: Partial<DraftQuestion>) => {
    const next = [...questions];
    next[i] = { ...next[i], ...patch };
    onChange(next);
  };
  const remove = (i: number) => {
    const next = questions.filter((_, idx) => idx !== i).map((q, idx) => ({ ...q, position: idx }));
    onChange(next);
  };
  const move = (i: number, dir: -1 | 1) => {
    const j = i + dir;
    if (j < 0 || j >= questions.length) return;
    const next = [...questions];
    [next[i], next[j]] = [next[j], next[i]];
    onChange(next.map((q, idx) => ({ ...q, position: idx })));
  };
  const add = () => onChange([...questions, newQuestion(questions.length)]);

  return (
    <div className="space-y-3">
      {questions.map((q, i) => (
        <div key={q.tempId} className="rounded-lg border p-3 space-y-3 bg-card">
          <div className="flex items-start gap-2">
            <GripVertical className="h-4 w-4 mt-2 text-muted-foreground" />
            <div className="flex-1 grid gap-2 sm:grid-cols-[1fr_200px]">
              <div className="space-y-1">
                <Label className="text-xs">Întrebarea {i + 1}</Label>
                <Input
                  value={q.text}
                  onChange={(e) => update(i, { text: e.target.value })}
                  placeholder="Scrie întrebarea…"
                />
              </div>
              <div className="space-y-1">
                <Label className="text-xs">Tip</Label>
                <Select value={q.question_type} onValueChange={(v) => update(i, { question_type: v as FbQType })}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Object.entries(TYPE_LABEL).map(([v, l]) => (
                      <SelectItem key={v} value={v}>{l}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="flex flex-col gap-1">
              <Button variant="ghost" size="icon" type="button" onClick={() => move(i, -1)}><ArrowUp className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" type="button" onClick={() => move(i, 1)}><ArrowDown className="h-4 w-4" /></Button>
              <Button variant="ghost" size="icon" type="button" onClick={() => remove(i)}><Trash2 className="h-4 w-4 text-destructive" /></Button>
            </div>
          </div>

          {(q.question_type === "single_choice" || q.question_type === "multi_choice" || q.question_type === "dropdown") && (
            <div className="space-y-2 pl-6">
              <Label className="text-xs">Opțiuni</Label>
              {q.options.map((opt, oi) => (
                <div key={oi} className="flex gap-2">
                  <Input
                    value={opt}
                    onChange={(e) => {
                      const opts = [...q.options]; opts[oi] = e.target.value;
                      update(i, { options: opts });
                    }}
                  />
                  <Button type="button" variant="ghost" size="icon" onClick={() => update(i, { options: q.options.filter((_, x) => x !== oi) })}>
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              ))}
              <Button type="button" variant="outline" size="sm" onClick={() => update(i, { options: [...q.options, `Opțiune ${q.options.length + 1}`] })}>
                <Plus className="h-3 w-3 mr-1" /> Adaugă opțiune
              </Button>
            </div>
          )}

          {q.question_type === "scale" && (
            <div className="grid gap-2 pl-6 sm:grid-cols-4">
              <div><Label className="text-xs">Min</Label><Input type="number" value={q.scale_min} onChange={(e) => update(i, { scale_min: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Max</Label><Input type="number" value={q.scale_max} onChange={(e) => update(i, { scale_max: Number(e.target.value) })} /></div>
              <div><Label className="text-xs">Etichetă min</Label><Input value={q.scale_min_label} onChange={(e) => update(i, { scale_min_label: e.target.value })} placeholder="ex: Slab" /></div>
              <div><Label className="text-xs">Etichetă max</Label><Input value={q.scale_max_label} onChange={(e) => update(i, { scale_max_label: e.target.value })} placeholder="ex: Excelent" /></div>
            </div>
          )}

          {q.question_type === "open_text" && (
            <Textarea disabled placeholder="Răspuns text liber (preview)" className="ml-6" />
          )}

          <label className="flex items-center gap-2 pl-6 text-sm">
            <Checkbox checked={q.required} onCheckedChange={(v) => update(i, { required: Boolean(v) })} />
            Obligatoriu
          </label>
        </div>
      ))}
      <Button type="button" variant="outline" onClick={add}>
        <Plus className="h-4 w-4 mr-2" /> Adaugă întrebare
      </Button>
    </div>
  );
}
