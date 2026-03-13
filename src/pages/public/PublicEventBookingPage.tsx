import cncvLogo from "@/assets/cncv-logo.jpg";
import { formatDate } from "@/lib/time";
import { useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { ArrowLeft, CalendarDays, Clock, MapPin, Users, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { QRCodeSVG } from "qrcode.react";

interface BookingResult {
  reservation_code: string;
  tickets: { id: string; attendee_name: string; qr_code_data: string }[];
  event: { title: string; date: string; start_time: string; end_time: string; location: string | null };
}

export default function PublicEventBookingPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [numTickets, setNumTickets] = useState(1);
  const [attendeeNames, setAttendeeNames] = useState<string[]>([""]);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<BookingResult | null>(null);
  const [honeypot, setHoneypot] = useState("");
  const [formLoadedAt] = useState(() => Date.now());

  const { data: event, isLoading } = useQuery({
    queryKey: ["public_event", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("events")
        .select("*")
        .eq("id", id!)
        .eq("is_public", true)
        .eq("published", true)
        .eq("status", "published")
        .single();
      if (error) throw error;
      return data;
    },
    enabled: !!id,
  });

  function handleNumChange(val: string) {
    const n = parseInt(val);
    setNumTickets(n);
    setAttendeeNames((prev) => {
      const next = [...prev];
      while (next.length < n) next.push("");
      return next.slice(0, n);
    });
  }

  function updateAttendeeName(idx: number, name: string) {
    setAttendeeNames((prev) => prev.map((n, i) => (i === idx ? name : n)));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (honeypot) { toast.error("Verificare de securitate eșuată"); return; }
    const elapsed = (Date.now() - formLoadedAt) / 1000;
    if (elapsed < 3) { toast.error("Vă rugăm să completați formularul mai încet"); return; }
    if (!guestName.trim()) { toast.error("Introduceți numele dvs."); return; }
    if (attendeeNames.some((n) => !n.trim())) { toast.error("Completați numele pentru fiecare participant"); return; }

    setSubmitting(true);
    try {
      const { data, error } = await supabase.functions.invoke("public-book-event", {
        body: {
          event_id: id,
          guest_name: guestName.trim(),
          guest_email: guestEmail.trim() || null,
          attendees: attendeeNames.map((n) => ({ name: n.trim() })),
        },
      });

      if (error) throw new Error(error.message);
      if (data.error) throw new Error(data.error);

      setResult(data as BookingResult);
      toast.success("Rezervare confirmată!");
    } catch (err: any) {
      toast.error(err.message || "Eroare la rezervare");
    } finally {
      setSubmitting(false);
    }
  }

  if (isLoading) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Se încarcă…</div>;
  if (!event) return <div className="min-h-screen flex items-center justify-center text-muted-foreground">Eveniment negăsit.</div>;

  // Show confirmation with tickets
  if (result) {
    return (
      <div className="min-h-screen bg-background">
        <div className="mx-auto max-w-2xl px-4 py-8">
          <div className="mb-6 text-center">
            <CheckCircle2 className="mx-auto h-12 w-12 text-green-600" />
            <h1 className="mt-3 font-display text-2xl font-bold">Rezervare confirmată!</h1>
            <div className="mt-3 rounded-lg border border-yellow-300 bg-yellow-50 p-4 text-sm text-yellow-900 dark:border-yellow-600 dark:bg-yellow-950 dark:text-yellow-200">
              <p className="font-semibold">⚠️ Important!</p>
              <p className="mt-1">Printează sau salvează ca PDF această pagină acum. Biletele <strong>nu pot fi recuperate ulterior</strong>.</p>
            </div>
          </div>

          <div className="space-y-4 print:space-y-6">
            {result.tickets.map((t, i) => (
              <Card key={t.id} className="print:break-inside-avoid">
                <CardContent className="p-5 flex items-center gap-4">
                  <QRCodeSVG value={t.qr_code_data} size={100} />
                  <div className="flex-1 space-y-1">
                    <p className="font-semibold">{t.attendee_name}</p>
                    <p className="text-sm font-medium">{result.event.title}</p>
                    <p className="text-xs text-muted-foreground">
                      {formatDate(result.event.date)} • {result.event.start_time?.slice(0, 5)} – {result.event.end_time?.slice(0, 5)}
                      {result.event.location && ` • ${result.event.location}`}
                    </p>
                    <p className="text-xs text-muted-foreground">Bilet {i + 1}/{result.tickets.length}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          <div className="mt-6 flex gap-3 print:hidden">
            <Button onClick={() => window.print()} className="flex-1">Printează biletele</Button>
            <Button variant="outline" onClick={() => navigate("/public/events")} className="flex-1">Înapoi la evenimente</Button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="mx-auto max-w-xl px-4 py-8">
        <div className="text-center mb-4">
          <img src={cncvLogo} alt="Logo CNCV" className="mx-auto h-16 w-16 object-contain" />
        </div>
        <Button variant="ghost" onClick={() => navigate("/public/events")} className="mb-4">
          <ArrowLeft className="mr-2 h-4 w-4" /> Înapoi
        </Button>

        <Card className="mb-6">
          <CardContent className="p-5 space-y-2">
            <h1 className="text-xl font-bold">{event.title}</h1>
            {event.description && <p className="text-sm text-muted-foreground">{event.description}</p>}
            <div className="flex flex-wrap gap-3 text-sm text-muted-foreground">
              <span className="flex items-center gap-1"><CalendarDays className="h-4 w-4" />{formatDate(event.date)}</span>
              <span className="flex items-center gap-1"><Clock className="h-4 w-4" />{event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)}</span>
              {event.location && <span className="flex items-center gap-1"><MapPin className="h-4 w-4" />{event.location}</span>}
              <span className="flex items-center gap-1"><Users className="h-4 w-4" />{event.max_capacity} locuri</span>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader><CardTitle>Rezervare locuri</CardTitle></CardHeader>
          <CardContent>
            <form onSubmit={handleSubmit} className="space-y-4">
              {/* Honeypot - hidden from humans */}
              <div className="absolute opacity-0 -z-10" aria-hidden="true" tabIndex={-1}>
                <label htmlFor="website_url">Website</label>
                <input id="website_url" name="website_url" type="text" value={honeypot} onChange={(e) => setHoneypot(e.target.value)} autoComplete="off" tabIndex={-1} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-name">Numele dvs. *</Label>
                <Input id="guest-name" value={guestName} onChange={(e) => setGuestName(e.target.value)} placeholder="Numele complet" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="guest-email">Email (opțional)</Label>
                <Input id="guest-email" type="email" value={guestEmail} onChange={(e) => setGuestEmail(e.target.value)} placeholder="email@exemplu.ro" />
              </div>
              <div className="space-y-2">
                <Label>Număr de locuri</Label>
                <Select value={String(numTickets)} onValueChange={handleNumChange}>
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {Array.from({ length: 32 }, (_, i) => i + 1).map((n) => (
                      <SelectItem key={n} value={String(n)}>{n} {n === 1 ? "loc" : "locuri"}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-3">
                {attendeeNames.map((name, idx) => (
                  <div key={idx} className="space-y-1">
                    <Label>Participant {idx + 1} *</Label>
                    <Input value={name} onChange={(e) => updateAttendeeName(idx, e.target.value)} placeholder="Numele participantului" />
                  </div>
                ))}
              </div>
              <Button type="submit" className="w-full" disabled={submitting}>
                {submitting ? "Se procesează…" : `Rezervă ${numTickets} ${numTickets === 1 ? "loc" : "locuri"}`}
              </Button>
            </form>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
