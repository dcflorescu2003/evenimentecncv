import { useEffect, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";

interface ClassRow {
  id: string;
  display_name: string;
  grade_number: number;
}

interface Props {
  eligibleGrades: number[];
  eligibleClasses: string[];
  onChange: (next: { eligibleGrades: number[]; eligibleClasses: string[] }) => void;
}

/**
 * Filtru de clase eligibile, identic cu cel folosit la Evenimente.
 * Nicio selecție = toate clasele eligibile.
 */
export function ClassEligibilityPicker({ eligibleGrades, eligibleClasses, onChange }: Props) {
  const { data: classes = [] } = useQuery({
    queryKey: ["classes-eligibility-picker"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("classes")
        .select("id, display_name, grade_number")
        .eq("is_active", true)
        .order("grade_number")
        .order("display_name");
      if (error) throw error;
      return (data ?? []) as ClassRow[];
    },
  });

  const classesByGrade = useMemo(() => {
    return classes.reduce<Record<number, ClassRow[]>>((acc, c) => {
      (acc[c.grade_number] ||= []).push(c);
      return acc;
    }, {});
  }, [classes]);

  function toggleGrade(grade: number) {
    const gradeClassIds = classes.filter((c) => c.grade_number === grade).map((c) => c.id);
    const has = eligibleGrades.includes(grade);
    const newGrades = has
      ? eligibleGrades.filter((g) => g !== grade)
      : [...eligibleGrades, grade].sort((a, b) => a - b);
    const newClasses = has
      ? eligibleClasses.filter((id) => !gradeClassIds.includes(id))
      : [...new Set([...eligibleClasses, ...gradeClassIds])];
    onChange({ eligibleGrades: newGrades, eligibleClasses: newClasses });
  }

  function toggleClass(classId: string, gradeNumber: number) {
    const newClasses = eligibleClasses.includes(classId)
      ? eligibleClasses.filter((id) => id !== classId)
      : [...eligibleClasses, classId];
    const gradeClassIds = classes.filter((c) => c.grade_number === gradeNumber).map((c) => c.id);
    const allSelected = gradeClassIds.every((id) => newClasses.includes(id));
    const noneSelected = gradeClassIds.every((id) => !newClasses.includes(id));
    let newGrades = [...eligibleGrades];
    if (allSelected && !newGrades.includes(gradeNumber)) {
      newGrades = [...newGrades, gradeNumber].sort((a, b) => a - b);
    } else if (!allSelected && newGrades.includes(gradeNumber) && noneSelected) {
      newGrades = newGrades.filter((g) => g !== gradeNumber);
    }
    onChange({ eligibleGrades: newGrades, eligibleClasses: newClasses });
  }

  return (
    <div className="space-y-2">
      <Label>Clase eligibile</Label>
      <div className="space-y-2 max-h-56 overflow-y-auto rounded-md border p-3">
        {Object.entries(classesByGrade)
          .sort(([a], [b]) => Number(a) - Number(b))
          .map(([grade, gradeClasses]) => {
            const gradeNum = Number(grade);
            const allClassIds = gradeClasses.map((c) => c.id);
            const allSelected = allClassIds.every((id) => eligibleClasses.includes(id));
            const someSelected = allClassIds.some((id) => eligibleClasses.includes(id));
            return (
              <div key={grade}>
                <label className="flex items-center gap-1.5 text-sm font-medium cursor-pointer">
                  <Checkbox
                    checked={allSelected}
                    onCheckedChange={() => toggleGrade(gradeNum)}
                    className={someSelected && !allSelected ? "opacity-60" : ""}
                  />
                  Clasa {grade}
                </label>
                <div className="ml-6 mt-1 flex flex-wrap gap-x-3 gap-y-1">
                  {gradeClasses.map((c) => (
                    <label key={c.id} className="flex items-center gap-1 text-sm cursor-pointer">
                      <Checkbox
                        checked={eligibleClasses.includes(c.id)}
                        onCheckedChange={() => toggleClass(c.id, gradeNum)}
                      />
                      {c.display_name}
                    </label>
                  ))}
                </div>
              </div>
            );
          })}
      </div>
      {eligibleClasses.length === 0 && eligibleGrades.length === 0 && (
        <p className="text-xs text-muted-foreground">Nicio selecție = toate clasele sunt eligibile</p>
      )}
    </div>
  );
}
