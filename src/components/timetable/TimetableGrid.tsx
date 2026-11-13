import { useState, type ReactNode } from "react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { DAYS, PERIODS, getCurrentPeriod } from "@/lib/schedule-periods";

export function defaultDay(): number {
  const c = getCurrentPeriod();
  if (c) return c.day;
  const d = new Date().getDay();
  return d >= 1 && d <= 5 ? d : 1;
}

/** Filtru Zi / Săptămână reutilizabil. */
export function useDayWeek() {
  const [mode, setMode] = useState<"day" | "week">("week");
  const [day, setDay] = useState<number>(defaultDay);
  return { mode, setMode, day, setDay };
}

export function DayWeekControls({ mode, setMode, day, setDay }: ReturnType<typeof useDayWeek>) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Tabs value={mode} onValueChange={(v) => setMode(v as "day" | "week")}>
        <TabsList>
          <TabsTrigger value="day">Zi</TabsTrigger>
          <TabsTrigger value="week">Săptămână</TabsTrigger>
        </TabsList>
      </Tabs>
      {mode === "day" && (
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" aria-label="Ziua anterioară" onClick={() => setDay(day <= 1 ? 5 : day - 1)}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          {DAYS.map((d) => (
            <Button key={d.value} size="sm" variant={d.value === day ? "default" : "ghost"} onClick={() => setDay(d.value)}>
              {d.label}
            </Button>
          ))}
          <Button variant="ghost" size="icon" aria-label="Ziua următoare" onClick={() => setDay(day >= 5 ? 1 : day + 1)}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      )}
    </div>
  );
}

interface GridProps {
  mode: "day" | "week";
  day: number;
  periods?: number[];
  renderCell: (day: number, period: number) => ReactNode | null;
}

/** Grilă orar: săptămână = tabel zile × ore; zi = listă ore. */
export default function TimetableGrid({ mode, day, periods, renderCell }: GridProps) {
  const current = getCurrentPeriod();
  const visible = PERIODS.filter((p) => !periods || periods.includes(p.period));
  if (mode === "day") {
    return (
      <div className="space-y-2">
        {visible.map((p) => {
          const now = current?.day === day && current?.period === p.period;
          return (
            <div key={p.period} className={`flex gap-3 rounded-md border p-2 ${now ? "border-primary bg-primary/5" : ""}`}>
              <div className="w-16 shrink-0 text-xs text-muted-foreground">
                <div className="font-medium text-foreground">Ora {p.period}</div>
                <div>{p.start}–{p.end}</div>
              </div>
              <div className="flex-1">{renderCell(day, p.period) ?? <span className="text-xs text-muted-foreground/40">—</span>}</div>
            </div>
          );
        })}
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full min-w-[640px] border-collapse text-sm">
        <thead>
          <tr>
            <th className="border-b p-2 text-left text-xs font-medium text-muted-foreground">Ora</th>
            {DAYS.map((d) => (
              <th key={d.value} className="border-b p-2 text-left text-xs font-medium text-muted-foreground">{d.label}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {visible.map((p) => (
            <tr key={p.period}>
              <td className="border-b p-2 align-top text-xs text-muted-foreground">
                <div className="font-semibold text-foreground">Ora {p.period}</div>
                <div>{p.start}–{p.end}</div>
              </td>
              {DAYS.map((d) => {
                const now = current?.day === d.value && current?.period === p.period;
                return (
                  <td key={d.value} className={`border-b p-2 align-top ${now ? "bg-primary/5 ring-1 ring-inset ring-primary/30" : ""}`}>
                    {renderCell(d.value, p.period) ?? <span className="text-xs text-muted-foreground/40">—</span>}
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
