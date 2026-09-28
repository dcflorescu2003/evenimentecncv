import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { enrollStudent } from "@/lib/manual-enrollment";
import { formatDate } from "@/lib/time";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";

export type EnrollStudent = {
  id: string;
  name: string;
  className: string;
  reservedHours: number;
  validatedHours: number;
  requiredHours: number;
};

type Ev = {
  id: string; title: string; date: string; start_time: string; end_time: string;
  location: string | null; counted_duration_hours: number | null; free_seats: number;
};

const req = (h: number, r: number) => `${h} / ${r > 0 ? r : "—"}`;

export default function HomeroomEnrollDialog({ student, sessionId, onClose, onEnrolled }: {
  student: EnrollStudent | null; sessionId: string; onClose: () => void; onEnrolled: () => void;
}) {
  const { user } = useAuth();
  const qc = useQueryClient();
  const [busyId, setBusyId] = useState<string | null>(null);
  const [addedHours, setAddedHours] = useState(0);

  const { data: events = [], isLoading } = useQuery({
    queryKey: ["enrollable-events", student?.id, sessionId],
    enabled: !!student && !!sessionId,
    queryFn: async () => {
      const { data, error } = await supabase.rpc("list_enrollable_events_for_student" as any, {
        _student_id: student!.id, _session_id: sessionId,
      });
      if (error) throw error;
      return (data ?? []) as Ev[];
    },
  });

  const enroll = async (ev: Ev) => {
    if (!student || !user) return;
    setBusyId(ev.id);
    const res = await enrollStudent(ev.id, student.id, { enrolledByUserId: user.id, enrolledByRole: "organizer" });
    setBusyId(null);
    if (!res.ok) { toast.error(res.reason ?? "Înscrierea a eșuat"); return; }
    toast.success(`${student.name} a fost înscris la „${ev.title}"`);
    setAddedHours(h => h + (ev.counted_duration_hours ?? 0));
    qc.invalidateQueries({ queryKey: ["enrollable-events"] });
    onEnrolled();
  };

  return (
    <Dialog open={!!student} onOpenChange={(o) => { if (!o) { setAddedHours(0); onClose(); } }}>
      <DialogContent className="max-w-2xl max-h-[85vh] overflow-y-auto">
        {student && (
          <>
            <DialogHeader>
              <DialogTitle>{student.name}</DialogTitle>
              <DialogDescription>{student.className}</DialogDescription>
            </DialogHeader>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="rounded-md border p-3">
                <div className="text-muted-foreground">Ore rezervate / minim</div>
                <div className="text-lg font-semibold">{req(student.reservedHours + addedHours, student.requiredHours)}</div>
              </div>
              <div className="rounded-md border p-3">
                <div className="text-muted-foreground">Ore validate / minim</div>
                <div className="text-lg font-semibold">{req(student.validatedHours, student.requiredHours)}</div>
              </div>
            </div>
            <h3 className="mt-2 font-semibold">Evenimente disponibile</h3>
            {isLoading ? (
              <p className="text-sm text-muted-foreground">Se încarcă...</p>
            ) : events.length === 0 ? (
              <p className="text-sm text-muted-foreground">Nu există evenimente viitoare la care elevul să poată fi înscris.</p>
            ) : (
              <ul className="space-y-2">
                {events.map(ev => (
                  <li key={ev.id} className="flex flex-col gap-2 rounded-md border p-3 sm:flex-row sm:items-center sm:justify-between">
                    <div>
                      <div className="font-medium">{ev.title}</div>
                      <div className="text-xs text-muted-foreground">
                        {formatDate(ev.date)}, {ev.start_time.slice(0, 5)}–{ev.end_time.slice(0, 5)}
                        {ev.location ? ` · ${ev.location}` : ""} · {ev.counted_duration_hours ?? 0} ore · {ev.free_seats} locuri libere
                      </div>
                    </div>
                    <Button size="sm" disabled={busyId !== null} onClick={() => enroll(ev)}>
                      {busyId === ev.id ? "Se înscrie..." : "Înscrie"}
                    </Button>
                  </li>
                ))}
              </ul>
            )}
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
