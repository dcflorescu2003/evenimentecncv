import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { CheckCircle2, XCircle, ScanLine } from "lucide-react";
import { toast } from "sonner";
import QrCameraScanner from "./QrCameraScanner";

type ScanEntry = { ok: boolean; text: string; at: number };

const statusLabel: Record<string, string> = { present: "Prezent", late: "Întârziat" };

/**
 * Dialog de scanare a legitimațiilor elevilor pentru o întâlnire de club
 * sau o zi de voluntariat.
 */
export default function AttendanceScanDialog({
  kind, targetId, title, onMarked,
}: {
  kind: "club" | "volunteer";
  targetId: string;
  title: string;
  onMarked?: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [manual, setManual] = useState("");
  const [entries, setEntries] = useState<ScanEntry[]>([]);

  async function handleScan(code: string) {
    const fn = kind === "club" ? "mark_club_attendance_by_qr" : "mark_volunteer_attendance_by_qr";
    const args = kind === "club"
      ? { _meeting_id: targetId, _student_qr: code }
      : { _day_id: targetId, _student_qr: code };
    const { data, error } = await supabase.rpc(fn as any, args as any);
    if (error) {
      setEntries((p) => [{ ok: false, text: error.message, at: Date.now() }, ...p].slice(0, 20));
      toast.error(error.message);
      return;
    }
    const res = (data ?? {}) as { success?: boolean; message?: string; name?: string; status?: string };
    if (res.success) {
      const text = `${res.name} — ${statusLabel[res.status ?? ""] ?? res.status}`;
      setEntries((p) => [{ ok: true, text, at: Date.now() }, ...p].slice(0, 20));
      toast.success("✓ " + text);
      onMarked?.();
    } else {
      const text = res.message ?? "Scanare eșuată.";
      setEntries((p) => [{ ok: false, text, at: Date.now() }, ...p].slice(0, 20));
      toast.error(text);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <ScanLine className="mr-1 h-4 w-4" /> Scanează
      </Button>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader><DialogTitle>Scanează prezența · {title}</DialogTitle></DialogHeader>
        {open && <QrCameraScanner onScan={handleScan} />}
        <div className="flex gap-2">
          <Input
            placeholder="Cod introdus manual"
            value={manual}
            onChange={(e) => setManual(e.target.value)}
          />
          <Button
            variant="secondary"
            onClick={() => { if (manual.trim()) { handleScan(manual.trim()); setManual(""); } }}
          >
            Marchează
          </Button>
        </div>
        {entries.length > 0 && (
          <div className="space-y-1">
            {entries.map((e) => (
              <div key={e.at} className="flex items-start gap-2 rounded-md border p-2 text-sm">
                {e.ok
                  ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  : <XCircle className="mt-0.5 h-4 w-4 shrink-0 text-destructive" />}
                <span>{e.text}</span>
              </div>
            ))}
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
