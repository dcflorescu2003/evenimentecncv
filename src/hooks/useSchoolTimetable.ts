import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { splitEntry } from "@/lib/timetable-import";

export interface TimetableRow {
  day_of_week: number; period: number; subject: string; teacher_name: string | null; room: string | null;
  teacher_ids: string[]; class_name: string; class_sort: string;
}
export interface TimetablePart { day: number; period: number; subject: string; room: string; teacher: string; teacherId: string | null; className: string }

/** Toate orele claselor active (paginat), desfăcute pe grupe. */
export function useSchoolTimetable() {
  return useQuery({
    queryKey: ["school_timetable"],
    staleTime: 5 * 60_000,
    queryFn: async () => {
      const { data: classes, error: ce } = await supabase
        .from("classes").select("id, display_name, academic_year, grade_number, section").eq("is_active", true);
      if (ce) throw ce;
      const { data: schedules, error: se } = await supabase.from("class_schedules").select("id, class_id, academic_year");
      if (se) throw se;
      const clsById = new Map((classes ?? []).map((c) => [c.id, c]));
      const schedToClass = new Map<string, { name: string; sort: string }>();
      for (const s of schedules ?? []) {
        const c = clsById.get(s.class_id);
        if (c && c.academic_year === s.academic_year)
          schedToClass.set(s.id, { name: c.display_name, sort: `${String(c.grade_number).padStart(2, "0")}${c.section ?? ""}` });
      }
      const ids = [...schedToClass.keys()];
      const rows: TimetableRow[] = [];
      for (let i = 0; i < ids.length; i += 50) {
        for (let from = 0; ; from += 1000) {
          const { data, error } = await supabase.from("schedule_entries")
            .select("schedule_id, day_of_week, period, subject, teacher_name, room, teacher_ids")
            .in("schedule_id", ids.slice(i, i + 50)).order("id").range(from, from + 999);
          if (error) throw error;
          for (const r of data ?? []) {
            const c = schedToClass.get(r.schedule_id)!;
            rows.push({ ...r, teacher_ids: r.teacher_ids ?? [], class_name: c.name, class_sort: c.sort });
          }
          if (!data || data.length < 1000) break;
        }
      }
      const nameToId = new Map<string, string>();
      for (const r of rows) {
        const names = (r.teacher_name ?? "").split(" / ").filter(Boolean);
        if (names.length === 1 && r.teacher_ids.length === 1) nameToId.set(names[0], r.teacher_ids[0]);
      }
      const parts: TimetablePart[] = [];
      for (const r of rows) {
        for (const s of splitEntry(r)) {
          parts.push({ day: r.day_of_week, period: r.period, subject: s.subject, room: s.room, teacher: s.teacher,
            teacherId: nameToId.get(s.teacher) ?? null, className: r.class_name });
        }
      }
      return { rows, parts };
    },
  });
}
