import { formatDate } from "@/lib/time";
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { Search, Copy, X } from "lucide-react";
import { toast } from "sonner";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const statusLabels: Record<string, string> = {
  reserved: "Rezervat", present: "Prezent", late: "Întârziat",
  absent: "Absent", excused: "Motivat", cancelled: "Anulat",
};

export default function PublicTicketViewPage() {
  const { code } = useParams<{ code: string }>();
  const [manualCode, setManualCode] = useState(code || "");
  const [searchCode, setSearchCode] = useState(code || "");
  const queryClient = useQueryClient();
  const [cancellingId, setCancellingId] = useState<string | null>(null);

  const { data, isLoading } = useQuery({
    queryKey: ["public_tickets_view", searchCode],
    queryFn: async () => {
      const { data: reservations, error } = await supabase
        .from("public_reservations")
        .select("*, public_tickets(*)")
        .eq("reservation_code", searchCode);
      if (error) throw error;
      if (!reservations || reservations.length === 0) return null;
      
      const reservation = reservations[0] as any;
      const { data: event } = await supabase
        .from("events")
        .select("title, date, start_time, end_time, location")
        .eq("id", reservation.event_id)
        .single();
      
      return { reservation, tickets: reservation.public_tickets || [], event };
    },
    enabled: !!searchCode && searchCode.length > 5,
  });

  const eventInPast = (() => {
    if (!data?.event) return false;
    const end = new Date(`${data.event.date}T${data.event.end_time || data.event.start_time}`);
    return end < new Date();
  })();

  async function handleCancel(ticketId?: string) {
    if (!data) return;
    setCancellingId(ticketId || "all");
    try {
      const { data: result, error } = await supabase.functions.invoke("public-cancel-ticket", {
        body: {
          reservation_code: data.reservation.reservation_code,
          ticket_id: ticketId,
        },
      });
      if (error) throw new Error(error.message);
      if (result?.error) throw new Error(result.error);
      toast.success(ticketId ? "Bilet anulat" : "Rezervare anulată");
      await queryClient.invalidateQueries({ queryKey: ["public_tickets_view", searchCode] });
    } catch (err: any) {
      toast.error(err.message || "Eroare la anulare");
    } finally {
      setCancellingId(null);
    }
  }

  const activeTickets = data?.tickets.filter((t: any) => t.status !== "cancelled") || [];
  const reservationActive = data?.reservation.status !== "cancelled" && activeTickets.length > 0;

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-2xl px-4 py-8">
        <h1 className="font-display text-2xl font-bold text-center mb-6">Vizualizare bilete</h1>

        <div className="flex gap-2 mb-6 print:hidden">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Introduceți codul de rezervare…"
              value={manualCode}
              onChange={(e) => setManualCode(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && setSearchCode(manualCode)}
              className="pl-9"
            />
          </div>
          <Button onClick={() => setSearchCode(manualCode)}>Caută</Button>
        </div>

        {isLoading && <p className="text-center text-muted-foreground">Se caută…</p>}

        {!isLoading && searchCode && !data && (
          <p className="text-center text-muted-foreground">Nicio rezervare găsită pentru acest cod.</p>
        )}

        {data && (
          <div className="space-y-4">
            <div className="text-center mb-4">
              <p className="text-sm text-muted-foreground">Rezervare: <strong className="font-mono">{data.reservation.reservation_code}</strong></p>
              <p className="text-sm">Rezervat de: <strong>{data.reservation.guest_name}</strong></p>
              {data.reservation.status === "cancelled" && (
                <Badge variant="destructive" className="mt-2">Rezervare anulată</Badge>
              )}
            </div>

            {data.tickets.map((t: any, i: number) => {
              const isCancelled = t.status === "cancelled";
              return (
                <Card key={t.id} className="print:break-inside-avoid">
                  <CardContent className="p-5 flex items-center gap-4">
                    {!isCancelled ? (
                      <QRCodeSVG value={t.qr_code_data} size={100} />
                    ) : (
                      <div className="h-[100px] w-[100px] flex items-center justify-center rounded bg-muted text-muted-foreground text-xs text-center px-2">
                        Bilet anulat
                      </div>
                    )}
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center gap-2">
                        <p className="font-semibold">{t.attendee_name}</p>
                        <Badge variant={isCancelled ? "destructive" : "secondary"} className="text-xs">{statusLabels[t.status] || t.status}</Badge>
                      </div>
                      {data.event && (
                        <>
                          <p className="text-sm font-medium">{data.event.title}</p>
                          <p className="text-xs text-muted-foreground">
                            {formatDate(data.event.date)} • {data.event.start_time?.slice(0, 5)} – {data.event.end_time?.slice(0, 5)}
                            {data.event.location && ` • ${data.event.location}`}
                          </p>
                        </>
                      )}
                      <p className="text-xs text-muted-foreground">Bilet {i + 1}/{data.tickets.length}</p>
                      {!isCancelled && (
                        <div className="flex items-center gap-2 pt-1">
                          <p className="text-[10px] text-muted-foreground font-mono break-all flex-1">{t.qr_code_data}</p>
                          <Button
                            variant="outline"
                            size="sm"
                            className="h-7 px-2 print:hidden"
                            onClick={() => {
                              navigator.clipboard.writeText(t.qr_code_data);
                              toast.success("Cod copiat");
                            }}
                          >
                            <Copy className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                      {!isCancelled && reservationActive && !eventInPast && (
                        <div className="pt-2 print:hidden">
                          <AlertDialog>
                            <AlertDialogTrigger asChild>
                              <Button variant="outline" size="sm" className="h-7 text-xs text-destructive hover:text-destructive">
                                <X className="h-3 w-3 mr-1" /> Anulează acest bilet
                              </Button>
                            </AlertDialogTrigger>
                            <AlertDialogContent>
                              <AlertDialogHeader>
                                <AlertDialogTitle>Anulezi acest bilet?</AlertDialogTitle>
                                <AlertDialogDescription>
                                  Locul va fi eliberat și nu va mai putea fi folosit. Această acțiune nu poate fi anulată.
                                </AlertDialogDescription>
                              </AlertDialogHeader>
                              <AlertDialogFooter>
                                <AlertDialogCancel>Renunță</AlertDialogCancel>
                                <AlertDialogAction
                                  onClick={() => handleCancel(t.id)}
                                  disabled={cancellingId === t.id}
                                >
                                  {cancellingId === t.id ? "Se anulează…" : "Anulează biletul"}
                                </AlertDialogAction>
                              </AlertDialogFooter>
                            </AlertDialogContent>
                          </AlertDialog>
                        </div>
                      )}
                    </div>
                  </CardContent>
                </Card>
              );
            })}

            <div className="flex flex-col sm:flex-row gap-3 print:hidden">
              <Button onClick={() => window.print()} className="flex-1">Printează biletele</Button>
              {reservationActive && !eventInPast && activeTickets.length > 1 && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button variant="destructive" className="flex-1">
                      Anulează toată rezervarea
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Anulezi toată rezervarea?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Toate cele {activeTickets.length} bilete vor fi anulate. Locurile vor fi eliberate. Această acțiune nu poate fi anulată.
                      </AlertDialogDescription>
                    </AlertDialogHeader>
                    <AlertDialogFooter>
                      <AlertDialogCancel>Renunță</AlertDialogCancel>
                      <AlertDialogAction
                        onClick={() => handleCancel()}
                        disabled={cancellingId === "all"}
                      >
                        {cancellingId === "all" ? "Se anulează…" : "Anulează rezervarea"}
                      </AlertDialogAction>
                    </AlertDialogFooter>
                  </AlertDialogContent>
                </AlertDialog>
              )}
            </div>
          </div>
        )}

        <footer className="mt-8 pb-6 text-center text-xs text-muted-foreground print:hidden">
          <Link to="/privacy" className="hover:underline">Politica de Confidențialitate</Link>
        </footer>
      </div>
    </div>
  );
}
