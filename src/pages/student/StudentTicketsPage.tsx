import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { CalendarDays, Clock, MapPin, Ticket, X } from "lucide-react";
import { QRCodeSVG } from "qrcode.react";
import { toast } from "sonner";
import type { Tables } from "@/integrations/supabase/types";

type Reservation = Tables<"reservations">;
type Event = Tables<"events">;
type TicketRow = Tables<"tickets">;

const ticketStatusLabels: Record<string, string> = {
  reserved: "Rezervat",
  cancelled: "Anulat",
  present: "Prezent",
  late: "Întârziat",
  absent: "Absent",
  excused: "Motivat",
};
const ticketStatusColors: Record<string, string> = {
  reserved: "bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-200",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  present: "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200",
  late: "bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-200",
  absent: "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200",
  excused: "bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-200",
};

export default function StudentTicketsPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const { data: reservations = [], isLoading } = useQuery({
    queryKey: ["all_my_reservations", user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("reservations")
        .select("*, events(*), tickets(*)")
        .eq("student_id", user!.id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data as unknown as (Reservation & { events: Event; tickets: TicketRow | null })[];
    },
    enabled: !!user,
  });

  const cancelMutation = useMutation({
    mutationFn: async (reservationId: string) => {
      const { error: resError } = await supabase
        .from("reservations")
        .update({ status: "cancelled", cancelled_at: new Date().toISOString() })
        .eq("id", reservationId);
      if (resError) throw new Error(resError.message);

      const { error: ticketError } = await supabase
        .from("tickets")
        .update({ status: "cancelled" })
        .eq("reservation_id", reservationId);
      if (ticketError) throw new Error(ticketError.message);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["all_my_reservations"] });
      queryClient.invalidateQueries({ queryKey: ["my_reservations"] });
      queryClient.invalidateQueries({ queryKey: ["student_progress"] });
      toast.success("Rezervare anulată");
      setCancelId(null);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const activeReservations = reservations.filter((r) => r.status === "reserved");
  const pastReservations = reservations.filter((r) => r.status !== "reserved");

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-display text-2xl font-bold">Biletele mele</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Rezervările și biletele tale cu cod QR.
        </p>
      </div>

      {isLoading ? (
        <div className="py-8 text-center text-muted-foreground">Se încarcă…</div>
      ) : reservations.length === 0 ? (
        <Card>
          <CardContent className="py-8 text-center text-muted-foreground">
            <Ticket className="mx-auto mb-2 h-8 w-8" />
            <p>Nu ai bilete încă.</p>
            <Button variant="link" onClick={() => navigate("/student/events")}>
              Explorează evenimente →
            </Button>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Active */}
          {activeReservations.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold">Active ({activeReservations.length})</h2>
              {activeReservations.map((r) => (
                <TicketCard
                  key={r.id}
                  reservation={r}
                  expanded={expandedId === r.id}
                  onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  onCancel={() => setCancelId(r.id)}
                  onNavigate={() => navigate(`/student/events/${r.event_id}`)}
                />
              ))}
            </div>
          )}

          {/* Past */}
          {pastReservations.length > 0 && (
            <div className="space-y-3">
              <h2 className="font-display text-lg font-semibold text-muted-foreground">Istoric ({pastReservations.length})</h2>
              {pastReservations.map((r) => (
                <TicketCard
                  key={r.id}
                  reservation={r}
                  expanded={expandedId === r.id}
                  onToggle={() => setExpandedId(expandedId === r.id ? null : r.id)}
                  onNavigate={() => navigate(`/student/events/${r.event_id}`)}
                  past
                />
              ))}
            </div>
          )}
        </>
      )}

      {/* Cancel Confirmation */}
      <AlertDialog open={!!cancelId} onOpenChange={(o) => !o && setCancelId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Anulează rezervarea?</AlertDialogTitle>
            <AlertDialogDescription>
              Biletul va fi anulat și locul va fi eliberat. Orele vor fi scăzute din progresul tău.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Păstrează</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => cancelId && cancelMutation.mutate(cancelId)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              disabled={cancelMutation.isPending}
            >
              {cancelMutation.isPending ? "Se anulează…" : "Anulează rezervarea"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

function TicketCard({
  reservation,
  expanded,
  onToggle,
  onCancel,
  onNavigate,
  past,
}: {
  reservation: Reservation & { events: Event; tickets: TicketRow | null };
  expanded: boolean;
  onToggle: () => void;
  onCancel?: () => void;
  onNavigate: () => void;
  past?: boolean;
}) {
  const ticket = reservation.tickets;
  const ticketStatus = ticket?.status || reservation.status;

  return (
    <Card className={`overflow-hidden transition-all ${past ? "opacity-70" : ""}`}>
      <CardContent className="p-0">
        <div
          className="flex items-center gap-3 p-4 cursor-pointer"
          onClick={onToggle}
        >
          <div className="flex-1">
            <p className="font-medium">{reservation.events?.title}</p>
            <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
              <span className="flex items-center gap-1">
                <CalendarDays className="h-3 w-3" /> {reservation.events?.date}
              </span>
              <span className="flex items-center gap-1">
                <Clock className="h-3 w-3" /> {reservation.events?.start_time?.slice(0, 5)} – {reservation.events?.end_time?.slice(0, 5)}
              </span>
              {reservation.events?.location && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3" /> {reservation.events.location}
                </span>
              )}
            </div>
          </div>
          <Badge variant="secondary" className={ticketStatusColors[ticketStatus]}>
            {ticketStatusLabels[ticketStatus]}
          </Badge>
        </div>

        {expanded && (
          <div className="border-t px-4 py-4 space-y-4">
            {/* QR Code */}
            {ticket && ticketStatus === "reserved" && (
              <div className="flex flex-col items-center gap-2">
                <QRCodeSVG
                  value={ticket.qr_code_data}
                  size={180}
                  level="M"
                  className="rounded-lg border p-2 bg-card"
                />
                <p className="text-xs text-muted-foreground font-mono">
                  {ticket.qr_code_data.slice(0, 8)}…
                </p>
              </div>
            )}

            {/* Attendance info for checked-in tickets */}
            {ticket && ["present", "late"].includes(ticketStatus) && ticket.checkin_timestamp && (
              <div className="rounded-lg bg-green-50 dark:bg-green-950 p-3 text-center">
                <p className="text-sm font-medium text-green-800 dark:text-green-200">
                  Check-in: {new Date(ticket.checkin_timestamp).toLocaleString("ro-RO")}
                </p>
              </div>
            )}

            <div className="flex gap-2">
              <Button variant="outline" size="sm" className="flex-1" onClick={onNavigate}>
                Detalii eveniment
              </Button>
              {!past && onCancel && (
                <Button variant="outline" size="sm" className="text-destructive" onClick={onCancel}>
                  <X className="mr-1 h-4 w-4" /> Anulează
                </Button>
              )}
            </div>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
