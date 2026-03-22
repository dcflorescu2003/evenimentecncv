import { formatDate } from "@/lib/time";
import { useState } from "react";
import { useParams, Link } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { QRCodeSVG } from "qrcode.react";
import { Search } from "lucide-react";

const statusLabels: Record<string, string> = {
  reserved: "Rezervat", present: "Prezent", late: "Întârziat",
  absent: "Absent", excused: "Motivat", cancelled: "Anulat",
};

export default function PublicTicketViewPage() {
  const { code } = useParams<{ code: string }>();
  const [manualCode, setManualCode] = useState(code || "");
  const [searchCode, setSearchCode] = useState(code || "");

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
      // Get event details
      const { data: event } = await supabase
        .from("events")
        .select("title, date, start_time, end_time, location")
        .eq("id", reservation.event_id)
        .single();
      
      return { reservation, tickets: reservation.public_tickets || [], event };
    },
    enabled: !!searchCode && searchCode.length > 5,
  });

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
            </div>

            {data.tickets.map((t: any, i: number) => (
              <Card key={t.id} className="print:break-inside-avoid">
                <CardContent className="p-5 flex items-center gap-4">
                  <QRCodeSVG value={t.qr_code_data} size={100} />
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <p className="font-semibold">{t.attendee_name}</p>
                      <Badge variant="secondary" className="text-xs">{statusLabels[t.status] || t.status}</Badge>
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
                  </div>
                </CardContent>
              </Card>
            ))}

            <div className="flex gap-3 print:hidden">
              <Button onClick={() => window.print()} className="flex-1">Printează biletele</Button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
