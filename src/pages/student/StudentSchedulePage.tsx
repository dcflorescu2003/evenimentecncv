import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { PERIODS, DAYS, getCurrentPeriod } from "@/lib/schedule-periods";
import { CalendarRange, ChevronLeft, ChevronRight, MapPin, User } from "lucide-react";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useIsMobile } from "@/hooks/use-mobile";
import CantinaMenuSection from "@/components/schedule/CantinaMenuSection";
import { fetchTeacherInitialsMap, resolveTeacherDisplay, type TeacherInitialsMap } from "@/lib/teacher-initials";

interface Entry {
  day_of_week: number;
  period: number;
  subject: string;
  teacher_name: string | null;
  room: string | null;
}

export default function StudentSchedulePage() {
  const { user } = useAuth();
  const isMobile = useIsMobile();
  const [loading, setLoading] = useState(true);
  const [className, setClassName] = useState<string | null>(null);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [initialsMap, setInitialsMap] = useState<TeacherInitialsMap>(new Map());
  const current = getCurrentPeriod();
  const [viewMode, setViewMode] = useState<"week" | "day">("week");
  const [selectedDay, setSelectedDay] = useState<number>(() => {
    const c = getCurrentPeriod();
    if (c) return c.day;
    const d = new Date().getDay();
    return d >= 1 && d <= 5 ? d : 1;
  });

  useEffect(() => {
    if (!user) return;
    (async () => {
      setLoading(true);
      fetchTeacherInitialsMap().then(setInitialsMap).catch(() => setInitialsMap(new Map()));
      const { data: assignment } = await supabase
        .from("student_class_assignments")
        .select("class_id, academic_year, classes(display_name)")
        .eq("student_id", user.id)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!assignment) {
        setLoading(false);
        return;
      }
      const cls = (assignment as { classes?: { display_name?: string } | null }).classes;
      setClassName(cls?.display_name ?? null);

      const { data: schedule } = await supabase
        .from("class_schedules")
        .select("id")
        .eq("class_id", assignment.class_id)
        .eq("academic_year", assignment.academic_year)
        .maybeSingle();

      if (schedule) {
        const { data: rows } = await supabase
          .from("schedule_entries")
          .select("day_of_week, period, subject, teacher_name, room")
          .eq("schedule_id", schedule.id);
        setEntries((rows as Entry[]) ?? []);
      }
      setLoading(false);
    })();
  }, [user]);

  const byKey = new Map<string, Entry>();
  entries.forEach((e) => byKey.set(`${e.day_of_week}-${e.period}`, e));

  const usedPeriods = new Set(entries.map((e) => e.period));
  const visiblePeriods = PERIODS.filter((p) => usedPeriods.has(p.period));

  const renderCell = (e: Entry | undefined) => {
    if (!e) return <span className="text-xs text-muted-foreground/40">—</span>;
    const teacherDisplay = resolveTeacherDisplay(e.teacher_name, initialsMap);
    return (
      <div className="flex flex-col gap-0.5 text-left">
        <span className="text-sm font-medium leading-tight">{e.subject}</span>
        {teacherDisplay && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <User className="h-3 w-3" />
            {teacherDisplay}
          </span>
        )}
        {e.room && (
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="h-3 w-3" />
            {e.room}
          </span>
        )}
      </div>
    );
  };

  const renderDayList = (day: number) => (
    <div className="space-y-2">
      {visiblePeriods.map((p) => {
        const e = byKey.get(`${day}-${p.period}`);
        const isNow = current?.day === day && current?.period === p.period;
        return (
          <div
            key={p.period}
            className={`flex gap-3 rounded-md border p-2 ${
              isNow ? "border-primary bg-primary/5" : ""
            }`}
          >
            <div className="w-16 shrink-0 text-xs text-muted-foreground">
              <div className="font-medium text-foreground">Ora {p.period}</div>
              <div>{p.start}</div>
              <div>{p.end}</div>
            </div>
            <div className="flex-1">{renderCell(e)}</div>
          </div>
        );
      })}
    </div>
  );

  const goPrevDay = () => setSelectedDay((d) => (d <= 1 ? 5 : d - 1));
  const goNextDay = () => setSelectedDay((d) => (d >= 5 ? 1 : d + 1));
  const selectedDayLabel = DAYS.find((d) => d.value === selectedDay)?.label ?? "";

  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <div>
        <h1 className="font-display text-2xl font-semibold">Orar & Meniu</h1>
        <p className="text-sm text-muted-foreground">
          {className ? `Clasa: ${className}` : "—"}
        </p>
      </div>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <CardTitle className="flex items-center gap-2 text-lg">
              <CalendarRange className="h-5 w-5 text-primary" />
              Orarul clasei
            </CardTitle>
            {!isMobile && entries.length > 0 && (
              <Tabs value={viewMode} onValueChange={(v) => setViewMode(v as "week" | "day")}>
                <TabsList>
                  <TabsTrigger value="week">Săptămână</TabsTrigger>
                  <TabsTrigger value="day">Zi</TabsTrigger>
                </TabsList>
              </Tabs>
            )}
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <Skeleton className="h-64 w-full" />
          ) : entries.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              {className
                ? "Clasa ta nu are încă un orar setat."
                : "Nu ai o clasă asociată contului tău."}
            </p>
          ) : isMobile ? (
            <Tabs defaultValue={String(current?.day ?? 1)}>
              <TabsList className="grid w-full grid-cols-5">
                {DAYS.map((d) => (
                  <TabsTrigger key={d.value} value={String(d.value)}>
                    {d.short}
                  </TabsTrigger>
                ))}
              </TabsList>
              {DAYS.map((d) => (
                <TabsContent key={d.value} value={String(d.value)} className="pt-3">
                  {renderDayList(d.value)}
                </TabsContent>
              ))}
            </Tabs>
          ) : viewMode === "day" ? (
            <div className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <Button variant="outline" size="sm" onClick={goPrevDay}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Ziua anterioară
                </Button>
                <div className="text-base font-semibold">{selectedDayLabel}</div>
                <Button variant="outline" size="sm" onClick={goNextDay}>
                  Ziua următoare
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
              <div className="flex flex-wrap justify-center gap-1">
                {DAYS.map((d) => (
                  <Button
                    key={d.value}
                    variant={d.value === selectedDay ? "default" : "ghost"}
                    size="sm"
                    onClick={() => setSelectedDay(d.value)}
                  >
                    {d.label}
                  </Button>
                ))}
              </div>
              {renderDayList(selectedDay)}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full border-collapse text-sm">
                <thead>
                  <tr>
                    <th className="border-b p-2 text-left text-xs font-medium text-muted-foreground">
                      Ora
                    </th>
                    {DAYS.map((d) => (
                      <th
                        key={d.value}
                        className="border-b p-2 text-left text-xs font-medium text-muted-foreground"
                      >
                        {d.label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {visiblePeriods.map((p) => (
                    <tr key={p.period}>
                      <td className="border-b p-2 align-top text-xs text-muted-foreground">
                        <div className="font-semibold text-foreground">Ora {p.period}</div>
                        <div>{p.start}–{p.end}</div>
                      </td>
                      {DAYS.map((d) => {
                        const e = byKey.get(`${d.value}-${p.period}`);
                        const isNow =
                          current?.day === d.value && current?.period === p.period;
                        return (
                          <td
                            key={d.value}
                            className={`border-b p-2 align-top ${
                              isNow ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""
                            }`}
                          >
                            {renderCell(e)}
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>

      <CantinaMenuSection />
    </div>
  );
}
