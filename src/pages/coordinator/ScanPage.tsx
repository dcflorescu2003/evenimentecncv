import { formatDate } from "@/lib/time";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, ScanLine, Keyboard, Search, CheckCircle2, XCircle, Clock, Camera, CameraOff,
} from "lucide-react";
import { toast } from "sonner";
import { determineAutoStatus } from "@/lib/attendance";

type TicketStatus = "present" | "late" | "absent" | "excused";

const statusLabels: Record<string, string> = {
  reserved: "Rezervat", present: "Prezent", late: "Întârziat",
  absent: "Absent", excused: "Motivat", cancelled: "Anulat",
};

export default function ScanPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("scan");
  const [manualCode, setManualCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [scanResult, setScanResult] = useState<{
    success: boolean;
    message: string;
    studentName?: string;
    ticketId?: string;
    isPublicTicket?: boolean;
  } | null>(null);
  
  const [scannerActive, setScannerActive] = useState(false);
  const scannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  const { data: event } = useQuery({
    queryKey: ["coord_event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // Search regular participants
  const { data: searchResults = [] } = useQuery({
    queryKey: ["search_participants", eventId, searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data, error } = await supabase
        .from("reservations")
        .select("*, profiles:student_id(id, first_name, last_name, display_name), tickets(*)")
        .eq("event_id", eventId!)
        .eq("status", "reserved");
      if (error) throw error;
      const q = searchQuery.toLowerCase();
      return (data || []).filter((r: any) => {
        const p = r.profiles;
        if (!p) return false;
        const name = `${p.first_name} ${p.last_name}`.toLowerCase();
        const display = (p.display_name || "").toLowerCase();
        return name.includes(q) || display.includes(q);
      }) as any[];
    },
    enabled: !!eventId && searchQuery.length >= 2,
  });

  // Search public participants
  const { data: publicSearchResults = [] } = useQuery({
    queryKey: ["search_public_participants", eventId, searchQuery],
    queryFn: async () => {
      if (!searchQuery || searchQuery.length < 2) return [];
      const { data, error } = await supabase
        .from("public_reservations")
        .select("*, public_tickets(*)")
        .eq("event_id", eventId!)
        .eq("status", "reserved");
      if (error) return [];
      const q = searchQuery.toLowerCase();
      const results: any[] = [];
      (data || []).forEach((r: any) => {
        const tickets = r.public_tickets || [];
        tickets.forEach((t: any) => {
          if (t.attendee_name.toLowerCase().includes(q)) {
            results.push({ ...t, reservation: r, isPublic: true });
          }
        });
      });
      return results;
    },
    enabled: !!eventId && searchQuery.length >= 2,
  });

  // QR Scanner
  const startScanner = useCallback(async () => {
    if (scannerRef.current || !videoRef.current) return;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("qr-reader");
      scannerRef.current = scanner;
      await scanner.start(
        { facingMode: "environment" },
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => {
          handleQrResult(decodedText);
        },
        () => {}
      );
      setScannerActive(true);
    } catch (err: any) {
      toast.error("Nu s-a putut porni camera: " + (err.message || err));
    }
  }, []);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
      setScannerActive(false);
    }
  }, []);

  useEffect(() => {
    return () => { stopScanner(); };
  }, [stopScanner]);

  useEffect(() => {
    if (activeTab === "scan") {
      const t = setTimeout(() => startScanner(), 300);
      return () => clearTimeout(t);
    } else {
      stopScanner();
    }
  }, [activeTab, startScanner, stopScanner]);

  async function handleQrResult(qrData: string) {
    await stopScanner();
    await processTicket(qrData);
  }

  async function handleManualSubmit() {
    if (!manualCode.trim()) return;
    await processTicket(manualCode.trim());
    setManualCode("");
  }

  async function processTicket(qrCodeData: string) {
    // First try regular tickets
    const { data: ticket, error } = await supabase
      .from("tickets")
      .select("*, reservations(*, profiles:student_id(first_name, last_name, display_name))")
      .eq("qr_code_data", qrCodeData)
      .maybeSingle();

    if (ticket) {
      const reservation = (ticket as any).reservations;
      if (!reservation || reservation.event_id !== eventId) {
        setScanResult({ success: false, message: "Biletul nu aparține acestui eveniment." });
        return;
      }

      if (ticket.status !== "reserved") {
        const name = reservation.profiles?.display_name || `${reservation.profiles?.first_name} ${reservation.profiles?.last_name}`;
        setScanResult({
          success: false,
          message: `Biletul a fost deja procesat (${statusLabels[ticket.status]}).`,
          studentName: name,
          ticketId: ticket.id,
        });
        return;
      }

      // Auto-determine and mark status
      const name = reservation.profiles?.display_name || `${reservation.profiles?.first_name} ${reservation.profiles?.last_name}`;
      if (event) {
        const autoStatus = determineAutoStatus(event.date, event.start_time);
        await autoMarkTicket(ticket.id, autoStatus, "reserved", false);
        toast.success(`✓ ${name} — ${statusLabels[autoStatus]}`);
        if (activeTab === "scan") setTimeout(() => startScanner(), 500);
      }
      return;
    }

    // Try public tickets
    const { data: publicTicket } = await supabase
      .from("public_tickets")
      .select("*, public_reservations(event_id, guest_name)")
      .eq("qr_code_data", qrCodeData)
      .maybeSingle();

    if (publicTicket) {
      const pr = (publicTicket as any).public_reservations;
      if (!pr || pr.event_id !== eventId) {
        setScanResult({ success: false, message: "Biletul nu aparține acestui eveniment." });
        return;
      }

      if (publicTicket.status !== "reserved") {
        setScanResult({
          success: false,
          message: `Biletul a fost deja procesat (${statusLabels[publicTicket.status]}).`,
          studentName: `${publicTicket.attendee_name} (Vizitator)`,
          ticketId: publicTicket.id,
          isPublicTicket: true,
        });
        return;
      }

      // Auto-determine and mark status
      if (event) {
        const autoStatus = determineAutoStatus(event.date, event.start_time);
        await autoMarkTicket(publicTicket.id, autoStatus, "reserved", true);
        toast.success(`✓ ${publicTicket.attendee_name} (Vizitator) — ${statusLabels[autoStatus]}`);
        if (activeTab === "scan") setTimeout(() => startScanner(), 500);
      }
      return;
    }

    setScanResult({ success: false, message: "Bilet negăsit. Verificați codul." });
  }

  async function autoMarkTicket(ticketId: string, status: TicketStatus, previousStatus: string, isPublic: boolean) {
    const table = isPublic ? "public_tickets" : "tickets";
    const { error: updateError } = await supabase
      .from(table)
      .update({
        status,
        checkin_timestamp: new Date().toISOString(),
      } as any)
      .eq("id", ticketId);
    if (updateError) { toast.error(updateError.message); return; }

    if (!isPublic) {
      await supabase.from("attendance_log").insert({
        ticket_id: ticketId,
        previous_status: previousStatus as any,
        new_status: status as any,
        changed_by: user!.id,
        notes: "Scanare automată",
      });
    }
    queryClient.invalidateQueries({ queryKey: ["search_participants"] });
    queryClient.invalidateQueries({ queryKey: ["search_public_participants"] });
  }


  async function markFromSearch(ticketId: string, status: TicketStatus, currentStatus: string, isPublic?: boolean) {
    const table = isPublic ? "public_tickets" : "tickets";
    const { error: updateError } = await supabase
      .from(table)
      .update({
        status,
        checkin_timestamp: ["present", "late"].includes(status) ? new Date().toISOString() : null,
      } as any)
      .eq("id", ticketId);
    if (updateError) { toast.error(updateError.message); return; }

    if (!isPublic) {
      await supabase.from("attendance_log").insert({
        ticket_id: ticketId,
        previous_status: currentStatus as any,
        new_status: status as any,
        changed_by: user!.id,
        notes: "Marcat manual de coordonator",
      });
    }

    toast.success("Prezență actualizată");
    queryClient.invalidateQueries({ queryKey: ["search_participants"] });
    queryClient.invalidateQueries({ queryKey: ["search_public_participants"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/coordinator")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-display text-lg font-bold">{event?.title || "Scanare QR"}</h1>
          {event && (
            <p className="text-xs text-muted-foreground">
              {formatDate(event.date)} • {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)}
            </p>
          )}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="scan" className="flex-1">
            <ScanLine className="mr-2 h-4 w-4" /> Scanează
          </TabsTrigger>
          <TabsTrigger value="manual" className="flex-1">
            <Keyboard className="mr-2 h-4 w-4" /> Cod manual
          </TabsTrigger>
          <TabsTrigger value="search" className="flex-1">
            <Search className="mr-2 h-4 w-4" /> Caută
          </TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-4">
          <div id="qr-reader" ref={videoRef} className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border bg-muted" style={{ minHeight: 300 }} />
          {!scannerActive && (
            <Button className="w-full" onClick={startScanner}><Camera className="mr-2 h-4 w-4" /> Pornește camera</Button>
          )}
          {scannerActive && (
            <Button variant="outline" className="w-full" onClick={stopScanner}><CameraOff className="mr-2 h-4 w-4" /> Oprește camera</Button>
          )}
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card>
            <CardContent className="p-4 space-y-3">
              <p className="text-sm text-muted-foreground">Introduceți codul QR al biletului manual.</p>
              <div className="flex gap-2">
                <Input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Cod bilet…" onKeyDown={(e) => e.key === "Enter" && handleManualSubmit()} />
                <Button onClick={handleManualSubmit}>Verifică</Button>
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Caută după nume…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>

          {/* Regular participants */}
          {searchResults.map((r: any) => {
            const ticket = Array.isArray(r.tickets) ? r.tickets[0] : r.tickets;
            const p = r.profiles;
            const name = p?.display_name || `${p?.first_name} ${p?.last_name}`;
            return (
              <Card key={r.id}>
                <CardContent className="p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="font-medium text-sm">{name}</span>
                    {ticket && <Badge variant="secondary" className="text-xs">{statusLabels[ticket.status]}</Badge>}
                  </div>
                  {ticket && ticket.status === "reserved" && (
                    <div className="flex gap-1">
                      <Button size="sm" variant="default" className="flex-1" onClick={() => markFromSearch(ticket.id, "present", ticket.status)}>
                        <CheckCircle2 className="mr-1 h-3 w-3" /> Prezent
                      </Button>
                      <Button size="sm" variant="outline" className="flex-1" onClick={() => markFromSearch(ticket.id, "late", ticket.status)}>
                        <Clock className="mr-1 h-3 w-3" /> Întârziat
                      </Button>
                    </div>
                  )}
                </CardContent>
              </Card>
            );
          })}

          {/* Public participants */}
          {publicSearchResults.map((t: any) => (
            <Card key={t.id}>
              <CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="font-medium text-sm">{t.attendee_name}</span>
                    <Badge variant="outline" className="text-xs">Vizitator</Badge>
                  </div>
                  <Badge variant="secondary" className="text-xs">{statusLabels[t.status]}</Badge>
                </div>
                {t.status === "reserved" && (
                  <div className="flex gap-1">
                    <Button size="sm" variant="default" className="flex-1" onClick={() => markFromSearch(t.id, "present", t.status, true)}>
                      <CheckCircle2 className="mr-1 h-3 w-3" /> Prezent
                    </Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => markFromSearch(t.id, "late", t.status, true)}>
                      <Clock className="mr-1 h-3 w-3" /> Întârziat
                    </Button>
                  </div>
                )}
              </CardContent>
            </Card>
          ))}

          {searchResults.length === 0 && publicSearchResults.length === 0 && searchQuery.length >= 2 && (
            <p className="text-sm text-center text-muted-foreground py-4">Niciun participant găsit.</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Scan Result Dialog */}
      <AlertDialog open={!!scanResult} onOpenChange={(o) => { if (!o) { setScanResult(null); if (activeTab === "scan") setTimeout(startScanner, 300); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              {scanResult?.success ? (
                <><CheckCircle2 className="h-5 w-5 text-green-600" /> Bilet valid</>
              ) : (
                <><XCircle className="h-5 w-5 text-destructive" /> Eroare</>
              )}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>{scanResult?.message}</p>
              {scanResult?.studentName && (
                <p className="font-medium text-foreground">{scanResult.studentName}</p>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          {scanResult?.success && scanResult?.ticketId && (
            <div className="space-y-2">
              <Select value={markStatus} onValueChange={(v) => setMarkStatus(v as TicketStatus)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="present">Prezent</SelectItem>
                  <SelectItem value="late">Întârziat</SelectItem>
                  <SelectItem value="absent">Absent</SelectItem>
                  <SelectItem value="excused">Motivat</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
          <AlertDialogFooter>
            <AlertDialogCancel>Închide</AlertDialogCancel>
            {scanResult?.success && scanResult?.ticketId && (
              <AlertDialogAction
                onClick={() => markMutation.mutate({ ticketId: scanResult.ticketId!, status: markStatus, isPublic: scanResult.isPublicTicket })}
                disabled={markMutation.isPending}
              >
                {markMutation.isPending ? "Se salvează…" : "Marchează"}
              </AlertDialogAction>
            )}
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
