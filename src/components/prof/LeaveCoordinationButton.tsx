import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { LogOut } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { leaveCoordination } from "@/lib/coordinators";

interface Props {
  eventId: string;
  eventTitle?: string;
  compact?: boolean;
  onLeft?: () => void;
}

export function LeaveCoordinationButton({ eventId, eventTitle, compact, onLeft }: Props) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const qc = useQueryClient();

  const submit = async () => {
    setBusy(true);
    try {
      await leaveCoordination(eventId, reason.trim());
      toast.success("Ai renunțat la coordonare. Organizatorul a fost anunțat.");
      qc.invalidateQueries();
      setOpen(false);
      onLeft?.();
    } catch (e: any) {
      toast.error(e?.message ?? "Nu s-a putut renunța");
    } finally {
      setBusy(false);
    }
  };

  return (
    <span onClick={(e) => e.stopPropagation()}>
      <Button
        variant="outline"
        size={compact ? "sm" : "default"}
        className="text-destructive"
        onClick={() => setOpen(true)}
      >
        <LogOut className="mr-1 h-4 w-4" /> Renunț la coordonare
      </Button>
      <AlertDialog open={open} onOpenChange={setOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Renunți la coordonare?</AlertDialogTitle>
            <AlertDialogDescription>
              Nu vei mai fi coordonator{eventTitle ? ` la „${eventTitle}"` : ""}, iar orele nu se vor mai număra la normă. Organizatorul primește o notificare.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <Textarea
            placeholder="Motiv (opțional)"
            value={reason}
            maxLength={500}
            onChange={(e) => setReason(e.target.value)}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Anulează</AlertDialogCancel>
            <Button variant="destructive" onClick={submit} disabled={busy}>
              {busy ? "Se trimite…" : "Renunț"}
            </Button>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </span>
  );
}
