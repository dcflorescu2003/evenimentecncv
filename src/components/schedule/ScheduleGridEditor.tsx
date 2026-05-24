import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { PERIODS, DAYS } from "@/lib/schedule-periods";
import { Save, Trash2 } from "lucide-react";

export interface EditorEntry {
  day_of_week: number;
  period: number;
  subject: string;
  teacher_name: string;
  room: string;
}

interface Props {
  initial: EditorEntry[];
  onSave: (entries: EditorEntry[]) => Promise<void>;
  saving?: boolean;
}

export default function ScheduleGridEditor({ initial, onSave, saving }: Props) {
  const buildMap = (rows: EditorEntry[]) => {
    const m = new Map<string, EditorEntry>();
    rows.forEach((r) => m.set(`${r.day_of_week}-${r.period}`, r));
    return m;
  };
  const [data, setData] = useState<Map<string, EditorEntry>>(buildMap(initial));

  const get = (day: number, period: number): EditorEntry =>
    data.get(`${day}-${period}`) ?? {
      day_of_week: day,
      period,
      subject: "",
      teacher_name: "",
      room: "",
    };

  const update = (day: number, period: number, patch: Partial<EditorEntry>) => {
    const key = `${day}-${period}`;
    const next = new Map(data);
    next.set(key, { ...get(day, period), ...patch });
    setData(next);
  };

  const clearCell = (day: number, period: number) => {
    const next = new Map(data);
    next.delete(`${day}-${period}`);
    setData(next);
  };

  const handleSave = async () => {
    const rows: EditorEntry[] = [];
    data.forEach((e) => {
      if (e.subject.trim()) rows.push(e);
    });
    await onSave(rows);
  };

  return (
    <div className="space-y-3">
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-sm">
          <thead>
            <tr>
              <th className="border bg-muted/40 p-2 text-xs">Ora</th>
              {DAYS.map((d) => (
                <th key={d.value} className="border bg-muted/40 p-2 text-xs">
                  {d.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {PERIODS.map((p) => (
              <tr key={p.period}>
                <td className="border bg-muted/20 p-2 align-top text-xs">
                  <div className="font-semibold">Ora {p.period}</div>
                  <div className="text-muted-foreground">{p.start}</div>
                  <div className="text-muted-foreground">{p.end}</div>
                </td>
                {DAYS.map((d) => {
                  const e = get(d.value, p.period);
                  return (
                    <td key={d.value} className="border p-1.5 align-top">
                      <div className="space-y-1">
                        <Input
                          placeholder="Materie"
                          value={e.subject}
                          onChange={(ev) =>
                            update(d.value, p.period, { subject: ev.target.value })
                          }
                          className="h-7 text-xs"
                        />
                        <Input
                          placeholder="Profesor"
                          value={e.teacher_name}
                          onChange={(ev) =>
                            update(d.value, p.period, { teacher_name: ev.target.value })
                          }
                          className="h-7 text-xs"
                        />
                        <div className="flex gap-1">
                          <Input
                            placeholder="Sală"
                            value={e.room}
                            onChange={(ev) =>
                              update(d.value, p.period, { room: ev.target.value })
                            }
                            className="h-7 text-xs"
                          />
                          {e.subject && (
                            <Button
                              type="button"
                              variant="ghost"
                              size="icon"
                              className="h-7 w-7 shrink-0"
                              onClick={() => clearCell(d.value, p.period)}
                            >
                              <Trash2 className="h-3 w-3" />
                            </Button>
                          )}
                        </div>
                      </div>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex justify-end">
        <Button onClick={handleSave} disabled={saving}>
          <Save className="mr-2 h-4 w-4" />
          {saving ? "Se salvează..." : "Salvează orarul"}
        </Button>
      </div>
    </div>
  );
}
