import { useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, CalendarDays, Clock, MapPin, ArrowRight } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import { cn } from "@/lib/utils";

type Event = Tables<"events">;
type View = "day" | "week" | "month";

interface Props {
  events: Event[];
  myReservationIds: Set<string>;
  reservationCounts: Record<string, number>;
}

const RO_DAYS_SHORT = ["L", "Ma", "Mi", "J", "V", "S", "D"];
const RO_DAYS_LONG = ["Luni", "Marți", "Miercuri", "Joi", "Vineri", "Sâmbătă", "Duminică"];
const RO_MONTHS = [
  "Ianuarie", "Februarie", "Martie", "Aprilie", "Mai", "Iunie",
  "Iulie", "August", "Septembrie", "Octombrie", "Noiembrie", "Decembrie",
];

function startOfDay(d: Date) {
  const x = new Date(d);
  x.setHours(0, 0, 0, 0);
  return x;
}
function addDays(d: Date, n: number) {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}
function addMonths(d: Date, n: number) {
  const x = new Date(d);
  x.setMonth(x.getMonth() + n);
  return x;
}
function isSameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}
// Monday-first weekday index: 0..6 (Mon..Sun)
function weekdayMonFirst(d: Date) {
  const w = d.getDay(); // 0=Sun..6=Sat
  return (w + 6) % 7;
}
function startOfWeek(d: Date) {
  return startOfDay(addDays(d, -weekdayMonFirst(d)));
}
function startOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth(), 1);
  return startOfDay(x);
}
function endOfMonth(d: Date) {
  const x = new Date(d.getFullYear(), d.getMonth() + 1, 0);
  return startOfDay(x);
}
// parse 'YYYY-MM-DD' as local date
function parseEventDate(dateStr: string): Date {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}
function fmtRange(time?: string | null) {
  return time ? time.slice(0, 5) : "";
}

type Status = "reserved" | "available" | "past_or_full";

function getEventStatus(
  ev: Event,
  myReservationIds: Set<string>,
  reservationCounts: Record<string, number>,
  today: Date,
): Status {
  if (myReservationIds.has(ev.id)) return "reserved";
  const evDate = parseEventDate(ev.date);
  const isPast = evDate < today;
  const reserved = reservationCounts[ev.id] || 0;
  const isFull = reserved >= ev.max_capacity;
  if (isPast || isFull) return "past_or_full";
  return "available";
}

function statusDotClass(s: Status) {
  if (s === "reserved") return "bg-green-500";
  if (s === "available") return "bg-primary";
  return "bg-muted-foreground/50";
}

function statusBadge(s: Status) {
  if (s === "reserved")
    return <Badge className="bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200 text-[10px]">Rezervat</Badge>;
  if (s === "available")
    return <Badge className="bg-primary/10 text-primary text-[10px]">Disponibil</Badge>;
  return <Badge variant="secondary" className="text-[10px]">Indisponibil</Badge>;
}

export default function EventsCalendar({ events, myReservationIds, reservationCounts }: Props) {
  const navigate = useNavigate();
  const today = useMemo(() => startOfDay(new Date()), []);
  const [view, setView] = useState<View>("week");
  const [currentDate, setCurrentDate] = useState<Date>(today);
  const [dayDialogDate, setDayDialogDate] = useState<Date | null>(null);

  // Group events by date string YYYY-MM-DD
  const eventsByDate = useMemo(() => {
    const map = new Map<string, Event[]>();
    for (const ev of events) {
      const arr = map.get(ev.date) || [];
      arr.push(ev);
      map.set(ev.date, arr);
    }
    // sort each day's events by start_time
    for (const arr of map.values()) {
      arr.sort((a, b) => (a.start_time || "").localeCompare(b.start_time || ""));
    }
    return map;
  }, [events]);

  function eventsOnDay(d: Date): Event[] {
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
    return eventsByDate.get(key) || [];
  }

  // Header label & navigation
  const headerLabel = useMemo(() => {
    if (view === "day") {
      return `${RO_DAYS_LONG[weekdayMonFirst(currentDate)]}, ${currentDate.getDate()} ${RO_MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
    }
    if (view === "week") {
      const ws = startOfWeek(currentDate);
      const we = addDays(ws, 6);
      const sameMonth = ws.getMonth() === we.getMonth();
      if (sameMonth) {
        return `${ws.getDate()} – ${we.getDate()} ${RO_MONTHS[ws.getMonth()]} ${ws.getFullYear()}`;
      }
      return `${ws.getDate()} ${RO_MONTHS[ws.getMonth()]} – ${we.getDate()} ${RO_MONTHS[we.getMonth()]} ${we.getFullYear()}`;
    }
    return `${RO_MONTHS[currentDate.getMonth()]} ${currentDate.getFullYear()}`;
  }, [view, currentDate]);

  function goPrev() {
    if (view === "day") setCurrentDate(addDays(currentDate, -1));
    else if (view === "week") setCurrentDate(addDays(currentDate, -7));
    else setCurrentDate(addMonths(currentDate, -1));
  }
  function goNext() {
    if (view === "day") setCurrentDate(addDays(currentDate, 1));
    else if (view === "week") setCurrentDate(addDays(currentDate, 7));
    else setCurrentDate(addMonths(currentDate, 1));
  }
  function goToday() {
    setCurrentDate(today);
  }

  // Counter in header
  const periodCount = useMemo(() => {
    if (view === "day") return eventsOnDay(currentDate).length;
    if (view === "week") {
      const ws = startOfWeek(currentDate);
      let count = 0;
      for (let i = 0; i < 7; i++) count += eventsOnDay(addDays(ws, i)).length;
      return count;
    }
    const ms = startOfMonth(currentDate);
    const me = endOfMonth(currentDate);
    let count = 0;
    for (let d = new Date(ms); d <= me; d = addDays(d, 1)) count += eventsOnDay(d).length;
    return count;
  }, [view, currentDate, eventsByDate]);

  // ---- Renderers ----
  function renderMonth() {
    const ms = startOfMonth(currentDate);
    const gridStart = startOfWeek(ms); // Monday on/before the 1st
    const cells: Date[] = [];
    for (let i = 0; i < 42; i++) cells.push(addDays(gridStart, i));

    return (
      <div>
        <div className="grid grid-cols-7 gap-1 text-center text-[11px] font-medium text-muted-foreground mb-1">
          {RO_DAYS_SHORT.map((d) => (
            <div key={d}>{d}</div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-1">
          {cells.map((d, i) => {
            const inMonth = d.getMonth() === currentDate.getMonth();
            const isToday = isSameDay(d, today);
            const dayEvents = eventsOnDay(d);
            const statuses = dayEvents.map((e) => getEventStatus(e, myReservationIds, reservationCounts, today));
            const hasReserved = statuses.includes("reserved");
            const hasAvailable = statuses.includes("available");
            const hasPast = statuses.includes("past_or_full");

            return (
              <button
                key={i}
                type="button"
                onClick={() => dayEvents.length > 0 && setDayDialogDate(d)}
                className={cn(
                  "aspect-square rounded-md border p-1 flex flex-col items-center justify-start text-xs transition-colors",
                  inMonth ? "bg-card" : "bg-muted/30 text-muted-foreground/60",
                  isToday && "border-primary border-2",
                  dayEvents.length > 0 ? "cursor-pointer hover:bg-muted" : "cursor-default",
                )}
              >
                <span className={cn("font-medium", isToday && "text-primary")}>{d.getDate()}</span>
                {dayEvents.length > 0 && (
                  <div className="mt-auto flex items-center gap-0.5 pb-0.5">
                    {hasReserved && <span className="h-1.5 w-1.5 rounded-full bg-green-500" />}
                    {hasAvailable && <span className="h-1.5 w-1.5 rounded-full bg-primary" />}
                    {hasPast && !hasAvailable && !hasReserved && (
                      <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" />
                    )}
                    {dayEvents.length > 1 && (
                      <span className="ml-0.5 text-[9px] font-semibold text-muted-foreground">
                        {dayEvents.length}
                      </span>
                    )}
                  </div>
                )}
              </button>
            );
          })}
        </div>
      </div>
    );
  }

  function renderWeek() {
    const ws = startOfWeek(currentDate);
    const days = Array.from({ length: 7 }, (_, i) => addDays(ws, i));
    return (
      <div className="grid grid-cols-1 sm:grid-cols-7 gap-2">
        {days.map((d, i) => {
          const dayEvents = eventsOnDay(d);
          const isToday = isSameDay(d, today);
          const isEmpty = dayEvents.length === 0;
          return (
            <div
              key={i}
              className={cn(
                "rounded-md border p-2 flex gap-2 sm:flex-col sm:gap-1.5 sm:min-h-[100px]",
                isToday && "border-primary border-2",
                isEmpty && "opacity-60 sm:opacity-100",
              )}
            >
              <div
                className={cn(
                  "text-[11px] font-semibold shrink-0 w-12 sm:w-auto",
                  isToday ? "text-primary" : "text-muted-foreground",
                )}
              >
                {RO_DAYS_SHORT[i]} {d.getDate()}
              </div>
              <div className="flex-1 min-w-0 flex flex-col gap-1.5">
                {isEmpty ? (
                  <div className="text-[10px] text-muted-foreground/60">—</div>
                ) : (
                  dayEvents.map((ev) => {
                    const s = getEventStatus(ev, myReservationIds, reservationCounts, today);
                    return (
                      <button
                        key={ev.id}
                        type="button"
                        onClick={() => navigate(`/student/events/${ev.id}`)}
                        className="text-left rounded border bg-card hover:bg-muted/60 p-1.5 transition-colors"
                      >
                        <div className="flex items-start gap-1">
                          <span className={cn("h-1.5 w-1.5 rounded-full mt-1 shrink-0", statusDotClass(s))} />
                          <div className="min-w-0 flex-1">
                            <p className="text-[11px] font-medium truncate">{ev.title}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {fmtRange(ev.start_time)}–{fmtRange(ev.end_time)}
                            </p>
                          </div>
                        </div>
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          );
        })}
      </div>
    );
  }

  function renderDay() {
    const dayEvents = eventsOnDay(currentDate);
    if (dayEvents.length === 0) {
      return (
        <div className="py-8 text-center text-sm text-muted-foreground">
          Niciun eveniment programat în această zi.
        </div>
      );
    }
    return (
      <div className="space-y-2">
        {dayEvents.map((ev) => {
          const s = getEventStatus(ev, myReservationIds, reservationCounts, today);
          const reserved = reservationCounts[ev.id] || 0;
          const remaining = Math.max(0, ev.max_capacity - reserved);
          return (
            <Card
              key={ev.id}
              className="cursor-pointer hover:bg-muted/40 transition-colors"
              onClick={() => navigate(`/student/events/${ev.id}`)}
            >
              <CardContent className="p-3 space-y-1.5">
                <div className="flex items-start justify-between gap-2">
                  <p className="font-medium text-sm">{ev.title}</p>
                  {statusBadge(s)}
                </div>
                {ev.description && (
                  <p className="text-xs text-muted-foreground line-clamp-2">{ev.description}</p>
                )}
                <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                  <span className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    {fmtRange(ev.start_time)}–{fmtRange(ev.end_time)}
                  </span>
                  {ev.location && (
                    <span className="flex items-center gap-1">
                      <MapPin className="h-3 w-3" />
                      {ev.location}
                    </span>
                  )}
                  <span>{remaining} / {ev.max_capacity} locuri</span>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>
    );
  }

  return (
    <Card>
      <CardContent className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-2">
            <CalendarDays className="h-4 w-4 text-primary" />
            <h2 className="font-display text-base font-semibold">Calendar evenimente</h2>
          </div>
          <Tabs value={view} onValueChange={(v) => setView(v as View)}>
            <TabsList className="h-8">
              <TabsTrigger value="day" className="text-xs px-2">Zi</TabsTrigger>
              <TabsTrigger value="week" className="text-xs px-2">Săpt.</TabsTrigger>
              <TabsTrigger value="month" className="text-xs px-2">Lună</TabsTrigger>
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={goPrev}>
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <Button variant="outline" size="sm" className="h-7 px-2 text-xs" onClick={goToday}>
              Azi
            </Button>
            <Button variant="outline" size="icon" className="h-7 w-7" onClick={goNext}>
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="text-sm font-medium text-right">
            <span>{headerLabel}</span>
            <span className="ml-2 text-xs text-muted-foreground">({periodCount})</span>
          </div>
        </div>

        {view === "month" && renderMonth()}
        {view === "week" && renderWeek()}
        {view === "day" && renderDay()}

        {/* Legend */}
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-[10px] text-muted-foreground pt-1 border-t">
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-primary" /> Disponibil
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-green-500" /> Rezervat de tine
          </span>
          <span className="flex items-center gap-1">
            <span className="h-1.5 w-1.5 rounded-full bg-muted-foreground/50" /> Trecut/Plin
          </span>
        </div>

        {/* Day dialog (from month view) */}
        <Dialog open={!!dayDialogDate} onOpenChange={(o) => !o && setDayDialogDate(null)}>
          <DialogContent className="max-w-md">
            <DialogHeader>
              <DialogTitle>
                {dayDialogDate &&
                  `${RO_DAYS_LONG[weekdayMonFirst(dayDialogDate)]}, ${dayDialogDate.getDate()} ${RO_MONTHS[dayDialogDate.getMonth()]} ${dayDialogDate.getFullYear()}`}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-2 max-h-[60vh] overflow-y-auto">
              {dayDialogDate &&
                eventsOnDay(dayDialogDate).map((ev) => {
                  const s = getEventStatus(ev, myReservationIds, reservationCounts, today);
                  const reserved = reservationCounts[ev.id] || 0;
                  const remaining = Math.max(0, ev.max_capacity - reserved);
                  return (
                    <button
                      key={ev.id}
                      type="button"
                      onClick={() => {
                        setDayDialogDate(null);
                        navigate(`/student/events/${ev.id}`);
                      }}
                      className="w-full text-left rounded-lg border p-3 hover:bg-muted/50 transition-colors"
                    >
                      <div className="flex items-start justify-between gap-2 mb-1">
                        <p className="font-medium text-sm">{ev.title}</p>
                        {statusBadge(s)}
                      </div>
                      <div className="flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {fmtRange(ev.start_time)}–{fmtRange(ev.end_time)}
                        </span>
                        {ev.location && (
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3 w-3" />
                            {ev.location}
                          </span>
                        )}
                        <span>{remaining} locuri libere</span>
                      </div>
                      <div className="flex items-center justify-end mt-1.5 text-[11px] text-primary">
                        Vezi detalii <ArrowRight className="ml-1 h-3 w-3" />
                      </div>
                    </button>
                  );
                })}
            </div>
          </DialogContent>
        </Dialog>
      </CardContent>
    </Card>
  );
}
