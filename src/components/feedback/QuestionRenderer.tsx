import { useState } from "react";
import { Label } from "@/components/ui/label";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

export interface RenderQuestion {
  id: string;
  position: number;
  question_type: "single_choice" | "multi_choice" | "dropdown" | "scale" | "open_text";
  text: string;
  required: boolean;
  options?: string[] | null;
  scale_min?: number | null;
  scale_max?: number | null;
  scale_min_label?: string | null;
  scale_max_label?: string | null;
}

interface Props {
  question: RenderQuestion;
  value: unknown;
  onChange: (v: unknown) => void;
  index: number;
}

export function QuestionRenderer({ question: q, value, onChange, index }: Props) {
  const min = q.scale_min ?? 1;
  const max = q.scale_max ?? 5;
  const scaleValues = Array.from({ length: max - min + 1 }, (_, i) => min + i);

  return (
    <div className="space-y-2 rounded-lg border p-4 bg-card">
      <Label className="text-base">
        {index + 1}. {q.text} {q.required && <span className="text-destructive">*</span>}
      </Label>

      {q.question_type === "single_choice" && (
        <RadioGroup value={(value as string) ?? ""} onValueChange={onChange}>
          {(q.options ?? []).map((opt, i) => (
            <label key={i} className="flex items-center gap-2 cursor-pointer">
              <RadioGroupItem value={opt} id={`${q.id}-${i}`} />
              <span>{opt}</span>
            </label>
          ))}
        </RadioGroup>
      )}

      {q.question_type === "multi_choice" && (
        <div className="space-y-1">
          {(q.options ?? []).map((opt, i) => {
            const arr = (Array.isArray(value) ? value : []) as string[];
            const checked = arr.includes(opt);
            return (
              <label key={i} className="flex items-center gap-2 cursor-pointer">
                <Checkbox
                  checked={checked}
                  onCheckedChange={(v) => {
                    const next = v ? [...arr, opt] : arr.filter((x) => x !== opt);
                    onChange(next);
                  }}
                />
                <span>{opt}</span>
              </label>
            );
          })}
        </div>
      )}

      {q.question_type === "dropdown" && (
        <Select value={(value as string) ?? ""} onValueChange={onChange}>
          <SelectTrigger><SelectValue placeholder="Alege…" /></SelectTrigger>
          <SelectContent>
            {(q.options ?? []).map((opt, i) => (
              <SelectItem key={i} value={opt}>{opt}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}

      {q.question_type === "scale" && (
        <div className="space-y-1">
          <div className="flex flex-wrap gap-2">
            {scaleValues.map((n) => (
              <button
                key={n}
                type="button"
                onClick={() => onChange(n)}
                className={`h-10 w-10 rounded-full border text-sm font-medium transition-colors ${
                  value === n
                    ? "bg-primary text-primary-foreground border-primary"
                    : "bg-background hover:bg-accent"
                }`}
              >
                {n}
              </button>
            ))}
          </div>
          {(q.scale_min_label || q.scale_max_label) && (
            <div className="flex justify-between text-xs text-muted-foreground">
              <span>{q.scale_min_label}</span>
              <span>{q.scale_max_label}</span>
            </div>
          )}
        </div>
      )}

      {q.question_type === "open_text" && (
        <Textarea
          value={(value as string) ?? ""}
          onChange={(e) => onChange(e.target.value)}
          rows={4}
          maxLength={2000}
          placeholder="Răspunsul tău…"
        />
      )}
    </div>
  );
}
