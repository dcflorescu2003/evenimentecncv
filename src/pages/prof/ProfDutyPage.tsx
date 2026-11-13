import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import DutyScheduleSection from "@/components/duty/DutyScheduleSection";
import TimetableGrid, { DayWeekControls, useDayWeek } from "@/components/timetable/TimetableGrid";
import LessonCell from "@/components/timetable/LessonCell";
import { useSchoolTimetable, type TimetablePart } from "@/hooks/useSchoolTimetable";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CalendarRange, DoorOpen, Search, UserRound, Users } from "lucide-react";
import { DAYS, PERIODS } from "@/lib/schedule-periods";
import { norm } from "@/lib/timetable-import";
import { defaultDay } from "@/components/timetable/TimetableGrid";

type View = "mine" | "rooms" | "staff";

function groupBy(parts: TimetablePart[]) {
  const m = new Map<string, TimetablePart[]>();
  for (const p of parts) { const k = `${p.day}-${p.period}`; m.set(k, [...(m.get(k) ?? []), p]); }
  return m;
}

function PartsGrid({ parts, show }: { parts: TimetablePart[]; show: { cls?: boolean; room?: boolean; teacher?: boolean } }) {
  const dw = useDayWeek();
  const by = useMemo(() => groupBy(parts), [parts]);
  const used = [...new Set(parts.map((p) => p.period))];
  const periods = used.length ? PERIODS.map((p) => p.period).filter((n) => n <= Math.max(...used)) : undefined;
  return (
    <div className="space-y-3">
      <DayWeekControls {...dw} />
      <TimetableGrid mode={dw.mode} day={dw.day} periods={periods} renderCell={(d, p) => {
        const list = by.get(`${d}-${p}`);
        if (!list) return null;
        return <LessonCell parts={list.map((x) => ({ subject: x.subject, className: show.cls ? x.className : null, room: show.room ? x.room : null, teacher: show.teacher ? x.teacher : null }))} />;
      }} />
    </div>
  );
}

function MineView({ parts }: { parts: TimetablePart[] }) {
  const { user, profile } = useAuth();
  const myName = profile ? `${profile.last_name} ${profile.first_name}` : "";
  const mine = parts.filter((p) => p.teacherId === user?.id || (!p.teacherId && myName && p.teacher === myName));
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><CalendarRange className="h-5 w-5 text-primary" />Orarul meu</CardTitle></CardHeader>
        <CardContent>
          {mine.length === 0 ? <p className="text-sm text-muted-foreground">Nu am găsit ore în orar pentru contul tău.</p>
            : <PartsGrid parts={mine} show={{ cls: true, room: true }} />}
        </CardContent>
      </Card>
      <DutyScheduleSection />
    </div>
  );
}

function RoomsView({ parts }: { parts: TimetablePart[] }) {
  const { data: rooms = [] } = useQuery({
    queryKey: ["vr_rooms_active"],
    queryFn: async () => {
      const { data, error } = await supabase.from("vr_rooms").select("name, sort_order, is_active").eq("is_active", true).order("sort_order").order("name");
      if (error) throw error;
      return (data ?? []).map((r) => r.name);
    },
  });
  const allRooms = useMemo(() => {
    const extra = [...new Set(parts.map((p) => p.room).filter(Boolean))].filter((r) => !rooms.includes(r));
    return [...rooms, ...extra].sort((a, b) => a.localeCompare(b, "ro", { numeric: true }));
  }, [rooms, parts]);
  const [room, setRoom] = useState<string>("");
  const [fDay, setFDay] = useState<number>(defaultDay);
  const [fPeriod, setFPeriod] = useState<number>(1);
  const busy = new Set(parts.filter((p) => p.day === fDay && p.period === fPeriod).map((p) => p.room));
  const free = rooms.filter((r) => !busy.has(r));
  const selected = room || allRooms[0] || "";
  return (
    <div className="space-y-4">
      <Card>
        <CardHeader><CardTitle className="flex items-center gap-2 text-lg"><Search className="h-5 w-5 text-primary" />Caută o sală liberă</CardTitle></CardHeader>
        <CardContent className="space-y-3">
          <div className="flex flex-wrap gap-2">
            <Select value={String(fDay)} onValueChange={(v) => setFDay(Number(v))}>
              <SelectTrigger className="w-40" aria-label="Ziua"><SelectValue /></SelectTrigger>
              <SelectContent>{DAYS.map((d) => <SelectItem key={d.value} value={String(d.value)}>{d.label}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={String(fPeriod)} onValueChange={(v) => setFPeriod(Number(v))}>
              <SelectTrigger className="w-48" aria-label="Ora"><SelectValue /></SelectTrigger>
              <SelectContent>{PERIODS.map((p) => <SelectItem key={p.period} value={String(p.period)}>Ora {p.period} ({p.start}–{p.end})</SelectItem>)}</SelectContent>
            </Select>
          </div>
          <div className="text-sm text-muted-foreground">{free.length} săli libere</div>
          <div className="flex flex-wrap gap-2">
            {free.map((r) => (
              <Badge key={r} variant="secondary" className="cursor-pointer" onClick={() => setRoom(r)}>{r}</Badge>
            ))}
          </div>
        </CardContent>
      </Card>
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle className="flex items-center gap-2 text-lg"><DoorOpen className="h-5 w-5 text-primary" />Orarul sălii</CardTitle>
          <Select value={selected} onValueChange={setRoom}>
            <SelectTrigger className="w-60" aria-label="Sala"><SelectValue placeholder="Alege sala" /></SelectTrigger>
            <SelectContent>{allRooms.map((r) => <SelectItem key={r} value={r}>{r}</SelectItem>)}</SelectContent>
          </Select>
        </CardHeader>
        <CardContent>
          <PartsGrid parts={parts.filter((p) => p.room === selected)} show={{ cls: true, teacher: true }} />
        </CardContent>
      </Card>
    </div>
  );
}

function StaffView({ parts }: { parts: TimetablePart[] }) {
  const [q, setQ] = useState("");
  const [colleague, setColleague] = useState<string | null>(null);
  const [day, setDay] = useState<number>(defaultDay);
  const teachers = useMemo(() => [...new Set(parts.map((p) => p.teacher).filter(Boolean))].sort((a, b) => a.localeCompare(b, "ro")), [parts]);
  const filtered = q ? teachers.filter((t) => norm(t).includes(norm(q))) : teachers;
  const byTeacherSlot = useMemo(() => {
    const m = new Map<string, TimetablePart[]>();
    for (const p of parts) if (p.day === day) { const k = `${p.teacher}|${p.period}`; m.set(k, [...(m.get(k) ?? []), p]); }
    return m;
  }, [parts, day]);
  if (colleague) {
    return (
      <Card>
        <CardHeader className="flex-row items-center justify-between gap-2 space-y-0">
          <CardTitle className="flex items-center gap-2 text-lg"><UserRound className="h-5 w-5 text-primary" />{colleague}</CardTitle>
          <Button variant="outline" size="sm" onClick={() => setColleague(null)}>Înapoi la cancelarie</Button>
        </CardHeader>
        <CardContent><PartsGrid parts={parts.filter((p) => p.teacher === colleague)} show={{ cls: true, room: true }} /></CardContent>
      </Card>
    );
  }
  return (
    <Card>
      <CardHeader className="space-y-3">
        <CardTitle className="flex items-center gap-2 text-lg"><Users className="h-5 w-5 text-primary" />Cancelarie</CardTitle>
        <div className="flex flex-wrap items-center gap-2">
          <Input placeholder="Caută un coleg…" value={q} onChange={(e) => setQ(e.target.value)} className="w-64" />
          <div className="flex flex-wrap gap-1">
            {DAYS.map((d) => <Button key={d.value} size="sm" variant={d.value === day ? "default" : "ghost"} onClick={() => setDay(d.value)}>{d.label}</Button>)}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="max-h-[70vh] overflow-auto overscroll-contain">
          <table className="w-full min-w-[900px] border-separate border-spacing-0 text-xs">
            <thead>
              <tr>
                <th className="sticky left-0 top-0 z-30 border-b bg-card p-2 text-left font-medium text-muted-foreground">Profesor</th>
                {PERIODS.map((p) => <th key={p.period} className="sticky top-0 z-20 border-b bg-card p-2 text-left font-medium text-muted-foreground">{p.period}<div className="font-normal">{p.start}</div></th>)}
              </tr>
            </thead>
            <tbody>
              {filtered.map((t) => (
                <tr key={t}>
                  <td className="sticky left-0 z-10 border-b bg-card p-2">
                    <button className="text-left font-medium text-primary hover:underline" onClick={() => setColleague(t)}>{t}</button>
                  </td>
                  {PERIODS.map((p) => {
                    const list = byTeacherSlot.get(`${t}|${p.period}`);
                    return (
                      <td key={p.period} className="border-b p-1.5 align-top">
                        {list?.map((x, i) => <div key={i}><span className="font-medium">{x.className}</span> <span className="text-muted-foreground">{x.room}</span></div>)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </CardContent>
    </Card>
  );
}

export default function ProfDutyPage() {
  const [view, setView] = useState<View>("mine");
  const { data, isLoading, error } = useSchoolTimetable();
  const parts = data?.parts ?? [];
  const titles: Record<View, string> = { mine: "Orarul meu", rooms: "Săli", staff: "Cancelarie" };
  return (
    <div className="space-y-4 pb-24">
      <h1 className="font-display text-2xl font-semibold">Orar – {titles[view]}</h1>
      {isLoading ? <Skeleton className="h-64 w-full" /> : error ? <p className="text-sm text-destructive">Orarul nu a putut fi încărcat.</p>
        : view === "mine" ? <MineView parts={parts} /> : view === "rooms" ? <RoomsView parts={parts} /> : <StaffView parts={parts} />}
      <nav className="pb-safe fixed inset-x-0 bottom-0 z-30 border-t bg-card/95 backdrop-blur">
        <div className="mx-auto grid max-w-md grid-cols-3 gap-1 p-2">
          {([["mine", "Orarul meu", CalendarRange], ["rooms", "Săli", DoorOpen], ["staff", "Cancelarie", Users]] as const).map(([v, label, Icon]) => (
            <Button key={v} variant={view === v ? "default" : "ghost"} className="flex h-auto flex-col gap-0.5 py-2" onClick={() => setView(v)}>
              <Icon className="h-5 w-5" /><span className="text-xs">{label}</span>
            </Button>
          ))}
        </div>
      </nav>
    </div>
  );
}
