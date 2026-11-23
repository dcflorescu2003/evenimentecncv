import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import { timetableViewsForRoles } from "@/lib/timetable-access";
import { splitEntry, norm } from "@/lib/timetable-import";
import { fetchTeacherInitialsMap, resolveTeacherDisplay } from "@/lib/teacher-initials";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Command, CommandInput, CommandList, CommandGroup, CommandItem, CommandEmpty } from "@/components/ui/command";
import { ChevronsUpDown, Check, X, GraduationCap, Search } from "lucide-react";
import TimetableGrid, { DayWeekControls, useDayWeek } from "./TimetableGrid";
import LessonCell from "./LessonCell";

type StudentMatch = { student_id: string; first_name: string; last_name: string; class_id: string; class_name: string; academic_year: string };

export default function ClassTimetableView() {
  const { user, roles } = useAuth();
  const allowed = !!user && timetableViewsForRoles(roles).includes("classes");
  const [classId, setClassId] = useState("");
  const [student, setStudent] = useState<StudentMatch | null>(null);
  const [term, setTerm] = useState("");
  const query = useDebouncedValue(term.trim(), 300);
  const [studentOpen, setStudentOpen] = useState(false);
  const [classOpen, setClassOpen] = useState(false);
  const dw = useDayWeek();
  const classes = useQuery({
    queryKey: ["timetable-active-classes", user?.id], enabled: allowed,
    queryFn: async () => {
      const rows: { id: string; display_name: string; academic_year: string }[] = [];
      for (let from = 0; ; from += 1000) {
        const { data, error } = await supabase.from("classes").select("id, display_name, academic_year")
          .eq("is_active", true).order("grade_number").order("section").order("id").range(from, from + 999);
        if (error) throw error;
        rows.push(...(data ?? []));
        if (!data || data.length < 1000) break;
      }
      return rows;
    },
  });
  const selectedClass = classes.data?.find((c) => c.id === classId);
  const matches = useQuery({
    queryKey: ["timetable-student-search", user?.id, query],
    enabled: allowed && studentOpen && query.length >= 2,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("search_students_for_timetable", { _term: query, _limit: 20 });
      if (error) throw error;
      return data as StudentMatch[];
    },
  });
  const timetable = useQuery({
    queryKey: ["class-timetable", user?.id, classId, selectedClass?.academic_year],
    enabled: allowed && !!selectedClass,
    queryFn: async () => {
      if (!selectedClass) return [];
      const { data: schedule, error } = await supabase.from("class_schedules").select("id")
        .eq("class_id", selectedClass.id).eq("academic_year", selectedClass.academic_year).maybeSingle();
      if (error) throw error;
      if (!schedule) return [];
      const { data: entries, error: entryError } = await supabase.from("schedule_entries")
        .select("day_of_week, period, subject, teacher_name, room").eq("schedule_id", schedule.id).order("id").range(0, 999);
      if (entryError) throw entryError;
      const initials = await fetchTeacherInitialsMap();
      return (entries ?? []).map((entry) => ({ ...entry, parts: splitEntry(entry).map((p) => ({
        subject: p.subject, room: p.room, teacher: p.teacher ? resolveTeacherDisplay(p.teacher, initials) : null,
      })) }));
    },
  });
  const bySlot = useMemo(() => new Map((timetable.data ?? []).map((e) => [`${e.day_of_week}-${e.period}`, e.parts])), [timetable.data]);
  const used = (timetable.data ?? []).map((e) => e.period);
  const periods = used.length ? Array.from({ length: Math.max(...used) - Math.min(...used) + 1 }, (_, i) => i + Math.min(...used)) : [];
  if (!allowed) return <p className="text-sm text-destructive">Nu ai acces la orarul claselor.</p>;
  return (
    <section className="min-w-0 max-w-[calc(100vw-1.5rem)] space-y-5 sm:max-w-none">
      <div className="grid gap-4 sm:grid-cols-2">
        <div className="min-w-0 space-y-2">
          <Label>Caută elev</Label>
          <Popover open={studentOpen} onOpenChange={setStudentOpen}>
            <PopoverTrigger asChild>
              <Button variant="outline" role="combobox" aria-expanded={studentOpen} aria-label="Caută elev" className="h-auto min-h-10 w-full justify-between gap-2 text-left">
                <Search className="h-4 w-4 shrink-0" /><span className="min-w-0 flex-1 whitespace-normal">{student ? `${student.last_name} ${student.first_name} — ${student.class_name}` : "Caută elev după nume…"}</span>
                <ChevronsUpDown className="h-4 w-4 shrink-0" />
              </Button>
            </PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
              <Command shouldFilter={false}>
                <CommandInput aria-label="Numele elevului" placeholder="Nume sau prenume…" value={term} onValueChange={setTerm} />
                <CommandList>
                  {query.length < 2 ? <p className="p-3 text-sm text-muted-foreground">Introdu cel puțin 2 caractere.</p>
                    : term.trim() !== query || matches.isFetching ? <p role="status" className="p-3 text-sm text-muted-foreground">Se caută…</p>
                    : matches.isError ? <p role="alert" className="p-3 text-sm text-destructive">Elevii nu au putut fi încărcați.</p>
                    : <><CommandEmpty>Niciun elev găsit.</CommandEmpty><CommandGroup>
                      {(matches.data ?? []).map((s) => <CommandItem key={s.student_id} value={s.student_id} onSelect={() => {
                        setStudent(s); setClassId(s.class_id); dw.setMode("week"); setStudentOpen(false);
                      }} className="items-start justify-between gap-2">
                        <span className="min-w-0 whitespace-normal">{s.last_name} {s.first_name}</span>
                        <span className="shrink-0 text-muted-foreground">{s.class_name}</span>
                      </CommandItem>)}
                    </CommandGroup></>}
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        <div className="space-y-2">
          <Label>Clasă</Label>
          <Popover open={classOpen} onOpenChange={setClassOpen}>
            <PopoverTrigger asChild><Button variant="outline" role="combobox" aria-label="Alege clasa" aria-expanded={classOpen} className="w-full justify-between" disabled={classes.isLoading || classes.isError}>
              {selectedClass?.display_name ?? "Alege clasa"}<ChevronsUpDown className="h-4 w-4" />
            </Button></PopoverTrigger>
            <PopoverContent align="start" className="w-[var(--radix-popover-trigger-width)] p-0">
              <Command filter={(value, search) => norm(value).includes(norm(search)) ? 1 : 0}>
                <CommandInput placeholder="Caută clasa…" /><CommandList><CommandEmpty>Nicio clasă găsită.</CommandEmpty><CommandGroup>
                  {(classes.data ?? []).map((c) => <CommandItem key={c.id} value={c.display_name} onSelect={() => { setClassId(c.id); setStudent(null); setClassOpen(false); dw.setMode("week"); }}>
                    <Check className={`mr-2 h-4 w-4 ${c.id === classId ? "opacity-100" : "opacity-0"}`} />{c.display_name}
                  </CommandItem>)}
                </CommandGroup></CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
      </div>
      {classes.isError && <p role="alert" className="text-sm text-destructive">Clasele nu au putut fi încărcate.</p>}
      {selectedClass && <div className="flex items-center justify-between gap-3 border-b pb-3">
        <div className="min-w-0"><h2 className="flex items-center gap-2 text-lg font-semibold"><GraduationCap className="h-5 w-5 shrink-0 text-primary" />Orarul clasei {selectedClass.display_name}</h2>
          {student && <p className="break-words text-sm text-muted-foreground">{student.last_name} {student.first_name}</p>}
        </div>
        {student && <Button variant="ghost" size="icon" aria-label="Elimină elevul selectat" title="Elimină elevul selectat" onClick={() => { setStudent(null); setTerm(""); }}><X className="h-4 w-4" /></Button>}
      </div>}
      {!classId ? <p className="text-sm text-muted-foreground">Nicio clasă selectată.</p>
        : timetable.isLoading ? <Skeleton className="h-64 w-full" />
        : timetable.isError ? <p role="alert" className="text-sm text-destructive">Orarul nu a putut fi încărcat.</p>
        : !timetable.data?.length ? <p className="text-sm text-muted-foreground">Clasa nu are încă un orar setat.</p>
        : <div className="space-y-3 [&>div>div]:flex-wrap"><DayWeekControls {...dw} /><TimetableGrid mode={dw.mode} day={dw.day} periods={periods} renderCell={(day, period) => {
          const parts = bySlot.get(`${day}-${period}`); return parts ? <LessonCell parts={parts} /> : null;
        }} /></div>}
    </section>
  );
}