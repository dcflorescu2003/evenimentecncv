import { useEffect, useRef } from "react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { toast } from "sonner";

export type LocationValue = { room_id: string | null; location: string; inSchool: boolean };

export default function LocationField({ value, onChange, date, start, end, excludeEventId }: {
  value: LocationValue;
  onChange: (v: LocationValue) => void;
  date: string; start: string; end: string; excludeEventId?: string | null;
}) {
  const ready = !!date && /^\d{2}:\d{2}/.test(start) && /^\d{2}:\d{2}/.test(end) && end > start;

  const { data: rooms, isFetching } = useQuery({
    queryKey: ["available_rooms", date, start, end, excludeEventId ?? null],
    enabled: value.inSchool && ready,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("get_available_rooms" as any, {
        _date: date, _start: start, _end: end, _exclude_event_id: excludeEventId ?? null,
      });
      if (error) throw error;
      return (data ?? []) as { id: string; name: string }[];
    },
  });

  const latest = useRef(value);
  latest.current = value;
  useEffect(() => {
    const v = latest.current;
    if (!v.inSchool || !v.room_id || !rooms || isFetching) return;
    if (!rooms.some((r) => r.id === v.room_id)) {
      toast.warning(`Sala ${v.location || ""} nu mai este liberă în intervalul ales. Alege altă sală.`);
      onChange({ ...v, room_id: null, location: "" });
    }
  }, [rooms, isFetching]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="space-y-2 sm:col-span-2">
      <Label>Locație</Label>
      <div className="inline-flex rounded-md border p-0.5 text-sm">
        {[true, false].map((ins) => (
          <button
            key={String(ins)}
            type="button"
            className={`rounded px-3 py-1 ${value.inSchool === ins ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
            onClick={() => onChange({ inSchool: ins, room_id: null, location: "" })}
          >
            {ins ? "În liceu" : "În afara liceului"}
          </button>
        ))}
      </div>
      {value.inSchool ? (
        !ready ? (
          <p className="text-xs text-muted-foreground">Alege întâi data și orele.</p>
        ) : (
          <Select
            value={value.room_id ?? ""}
            onValueChange={(id) => onChange({ inSchool: true, room_id: id, location: rooms?.find((r) => r.id === id)?.name ?? "" })}
          >
            <SelectTrigger>
              <SelectValue placeholder={isFetching ? "Se încarcă sălile…" : rooms?.length ? "Alege sala" : "Nicio sală liberă în acest interval"} />
            </SelectTrigger>
            <SelectContent>
              {value.room_id && !rooms?.some((r) => r.id === value.room_id) && (
                <SelectItem value={value.room_id}>{value.location}</SelectItem>
              )}
              {(rooms ?? []).map((r) => <SelectItem key={r.id} value={r.id}>{r.name}</SelectItem>)}
            </SelectContent>
          </Select>
        )
      ) : (
        <Input value={value.location} onChange={(e) => onChange({ inSchool: false, room_id: null, location: e.target.value })} placeholder="ex: Muzeul Național de Istorie" />
      )}
    </div>
  );
}
