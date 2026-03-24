import { formatDate } from "@/lib/time";
import { useState, useEffect, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Camera as CameraIcon, CameraOff } from "lucide-react";
import { Camera } from "@capacitor/camera";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, ScanLine, Keyboard, Search, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";
import { determineAutoStatus } from "@/lib/attendance";

type TicketStatus = "present" | "late" | "absent" | "excused";

const statusLabels: Record<string, string> = {
  reserved: "Rezervat", present: "Prezent", late: "Întârziat",
  absent: "Absent", excused: "Motivat", cancelled: "Anulat",
};

export default function StudentScanPage() {
  const { eventId } = useParams<{ eventId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const { user } = useAuth();

  const [activeTab, setActiveTab] = useState("scan");
  const [manualCode, setManualCode] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [scanResult, setScanResult] = useState<{
    success: boolean; message: string; studentName?: string; ticketId?: string; isPublicTicket?: boolean;
  } | null>(null);

  const [scannerActive, setScannerActive] = useState(false);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState<string>("auto");
  const [zoom, setZoom] = useState([1]);
  const [hasZoom, setHasZoom] = useState(false);
  const [isCamsInitialized, setIsCamsInitialized] = useState(false);
  const scannerRef = useRef<any>(null);
  const videoRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    async function initCams() {
      try {
        try {
          let status = await Camera.checkPermissions();
          if (status.camera !== 'granted') status = await Camera.requestPermissions();
          if (status.camera !== 'granted') {
             setIsCamsInitialized(true);
             return;
          }
        } catch(e) {}

        const { Html5Qrcode } = await import("html5-qrcode");
        const devices = await Html5Qrcode.getCameras();
        if (devices && devices.length > 0) setCameras(devices);
      } catch (err) {}
      setIsCamsInitialized(true);
    }
    initCams();
  }, []);

  // Verify assistant status
  const { data: isAssistant, isLoading: checkingAssistant } = useQuery({
    queryKey: ["check_assistant", user?.id, eventId],
    queryFn: async () => {
      const { data } = await supabase
        .from("event_student_assistants")
        .select("id")
        .eq("student_id", user!.id)
        .eq("event_id", eventId!)
        .maybeSingle();
      return !!data;
    },
    enabled: !!user && !!eventId,
  });

  const { data: event } = useQuery({
    queryKey: ["student_scan_event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId && isAssistant === true,
  });

  const { data: searchResults = [] } = useQuery({
    queryKey: ["student_search_participants", eventId, searchQuery],
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
        return `${p.last_name} ${p.first_name}`.toLowerCase().includes(q) || (p.display_name || "").toLowerCase().includes(q);
      }) as any[];
    },
    enabled: !!eventId && searchQuery.length >= 2 && isAssistant === true,
  });

  const { data: publicSearchResults = [] } = useQuery({
    queryKey: ["student_search_public", eventId, searchQuery],
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
        (r.public_tickets || []).forEach((t: any) => {
          if (t.attendee_name.toLowerCase().includes(q)) {
            results.push({ ...t, reservation: r, isPublic: true });
          }
        });
      });
      return results;
    },
    enabled: !!eventId && searchQuery.length >= 2 && isAssistant === true,
  });

  const startScanner = useCallback(async (cameraIdOverride?: string) => {
    if (scannerRef.current) return;
    try {
      try {
        let status = await Camera.checkPermissions();
        if (status.camera !== 'granted') status = await Camera.requestPermissions();
        if (status.camera !== 'granted') {
          toast.error("Permisiune cameră refuzată!");
          return;
        }
      } catch(e) {}

      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode("student-qr-reader");
      scannerRef.current = scanner;
      const cId = cameraIdOverride || selectedCameraId;
      const config = (cId && cId !== "auto") ? cId : { facingMode: "environment" };
      await scanner.start(
        config,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        (decodedText) => handleQrResult(decodedText),
        () => {}
      );
      setScannerActive(true);
      setTimeout(async () => {
        try {
          if (scannerRef.current) {
             await scannerRef.current.applyVideoConstraints({ advanced: [{ zoom: zoom[0] } as any] });
             setHasZoom(true);
          }
        } catch {
          setHasZoom(false);
        }
      }, 500);
    } catch (err: any) {
      toast.error("Eroare cameră: " + (err?.message || err));
      scannerRef.current = null;
      setScannerActive(false);
    }
  }, [selectedCameraId, zoom]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try {
        if (scannerRef.current.isScanning) await scannerRef.current.stop();
        scannerRef.current.clear();
      } catch {}
      scannerRef.current = null;
      setScannerActive(false);
    }
  }, []);

  useEffect(() => { return () => { stopScanner(); }; }, [stopScanner]);

  useEffect(() => {
    if (activeTab === "scan" && isAssistant && isCamsInitialized) {
      const t = setTimeout(() => {
         if (!scannerRef.current) startScanner();
      }, 500);
      return () => clearTimeout(t);
    } else { stopScanner(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isAssistant, isCamsInitialized]);

  async function handleQrResult(qrData: string) {
    await stopScanner();
    await processTicket(qrData);
  }

  async function processTicket(qrCodeData: string) {
    const { data: ticket } = await supabase
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
        setScanResult({ success: false, message: `Deja procesat (${statusLabels[ticket.status]}).`, studentName: `${reservation.profiles?.last_name || ""} ${reservation.profiles?.first_name || ""}`, ticketId: ticket.id });
        return;
      }
      const name = `${reservation.profiles?.last_name || ""} ${reservation.profiles?.first_name || ""}`;
      if (event) {
        const autoStatus = determineAutoStatus(event.date, event.start_time);
        await autoMarkTicket(ticket.id, autoStatus, "reserved", false);
        toast.success(`✓ ${name} — ${statusLabels[autoStatus]}`);
        if (activeTab === "scan") setTimeout(() => { if (!scannerRef.current) startScanner() }, 500);
      }
      return;
    }

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
        setScanResult({ success: false, message: `Deja procesat (${statusLabels[publicTicket.status]}).`, studentName: `${publicTicket.attendee_name} (Vizitator)`, ticketId: publicTicket.id, isPublicTicket: true });
        return;
      }
      if (event) {
        const autoStatus = determineAutoStatus(event.date, event.start_time);
        await autoMarkTicket(publicTicket.id, autoStatus, "reserved", true);
        toast.success(`✓ ${publicTicket.attendee_name} (Vizitator) — ${statusLabels[autoStatus]}`);
        if (activeTab === "scan") setTimeout(() => { if (!scannerRef.current) startScanner() }, 500);
      }
      return;
    }

    setScanResult({ success: false, message: "Bilet negăsit." });
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
        notes: "Scanare automată de elev asistent",
      });
    }
    queryClient.invalidateQueries({ queryKey: ["student_search_participants"] });
    queryClient.invalidateQueries({ queryKey: ["student_search_public"] });
  }

  async function markFromSearch(ticketId: string, status: TicketStatus, currentStatus: string, isPublic?: boolean) {
    const table = isPublic ? "public_tickets" : "tickets";
    const { error } = await supabase.from(table).update({
      status, checkin_timestamp: ["present", "late"].includes(status) ? new Date().toISOString() : null,
    } as any).eq("id", ticketId);
    if (error) { toast.error(error.message); return; }
    if (!isPublic) {
      await supabase.from("attendance_log").insert({
        ticket_id: ticketId, previous_status: currentStatus as any,
        new_status: status as any, changed_by: user!.id, notes: "Marcat manual de elev asistent",
      });
    }
    toast.success("Prezență actualizată");
    queryClient.invalidateQueries({ queryKey: ["student_search_participants"] });
    queryClient.invalidateQueries({ queryKey: ["student_search_public"] });
  }

  if (checkingAssistant) {
    return <div className="py-8 text-center text-muted-foreground">Se verifică…</div>;
  }

  if (!isAssistant) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="icon" onClick={() => navigate("/student")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <Card><CardContent className="py-8 text-center text-muted-foreground">
          <XCircle className="mx-auto mb-2 h-8 w-8 text-destructive" />
          <p>Nu ești asistent la acest eveniment.</p>
        </CardContent></Card>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate("/student")}>
          <ArrowLeft className="h-4 w-4" />
        </Button>
        <div>
          <h1 className="font-display text-lg font-bold">{event?.title || "Scanare QR"}</h1>
          {event && <p className="text-xs text-muted-foreground">{formatDate(event.date)} • {event.start_time?.slice(0, 5)} – {event.end_time?.slice(0, 5)}</p>}
        </div>
      </div>

      <Tabs value={activeTab} onValueChange={setActiveTab}>
        <TabsList className="w-full">
          <TabsTrigger value="scan" className="flex-1"><ScanLine className="mr-2 h-4 w-4" /> Scanează</TabsTrigger>
          <TabsTrigger value="manual" className="flex-1"><Keyboard className="mr-2 h-4 w-4" /> Cod manual</TabsTrigger>
          <TabsTrigger value="search" className="flex-1"><Search className="mr-2 h-4 w-4" /> Caută</TabsTrigger>
        </TabsList>

        <TabsContent value="scan" className="space-y-4">
          <div id="student-qr-reader" ref={videoRef} className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border bg-muted" style={{ minHeight: 300 }} />
          {hasZoom && scannerActive && (
            <div className="flex items-center gap-4 px-2">
              <span className="text-sm text-muted-foreground w-12">Zoom</span>
              <Slider value={zoom} min={1} max={5} step={0.1} onValueChange={(v) => {
                setZoom(v);
                if (scannerRef.current) scannerRef.current.applyVideoConstraints({ advanced: [{ zoom: v[0] } as any] }).catch(()=>{});
              }} />
            </div>
          )}
          {!scannerActive && (
            <Select value={selectedCameraId} onValueChange={(val) => {
              setSelectedCameraId(val);
              if (scannerActive) { stopScanner().then(() => startScanner(val)); }
            }}>
              <SelectTrigger><SelectValue placeholder="Alege camera" /></SelectTrigger>
              <SelectContent>
                 <SelectItem value="auto">Automată (Spate)</SelectItem>
                {cameras.map(c => <SelectItem key={c.id} value={c.id}>{c.label || "Cameră " + c.id}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {!scannerActive && <Button className="w-full" onClick={() => startScanner()}><CameraIcon className="mr-2 h-4 w-4" /> Pornește camera</Button>}
          {scannerActive && <Button variant="outline" className="w-full" onClick={stopScanner}><CameraOff className="mr-2 h-4 w-4" /> Oprește camera</Button>}
        </TabsContent>

        <TabsContent value="manual" className="space-y-4">
          <Card><CardContent className="p-4 space-y-3">
            <p className="text-sm text-muted-foreground">Introduceți codul QR manual.</p>
            <div className="flex gap-2">
              <Input value={manualCode} onChange={(e) => setManualCode(e.target.value)} placeholder="Cod bilet…" onKeyDown={(e) => e.key === "Enter" && processTicket(manualCode.trim())} />
              <Button onClick={() => { processTicket(manualCode.trim()); setManualCode(""); }}>Verifică</Button>
            </div>
          </CardContent></Card>
        </TabsContent>

        <TabsContent value="search" className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Caută după nume…" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} className="pl-9" />
          </div>
          {searchResults.map((r: any) => {
            const ticket = Array.isArray(r.tickets) ? r.tickets[0] : r.tickets;
            const p = r.profiles;
            const name = `${p?.last_name} ${p?.first_name}`;
            return (
              <Card key={r.id}><CardContent className="p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-medium text-sm">{name}</span>
                  {ticket && <Badge variant="secondary" className="text-xs">{statusLabels[ticket.status]}</Badge>}
                </div>
                {ticket && ticket.status === "reserved" && (
                  <div className="flex gap-1">
                    <Button size="sm" className="flex-1" onClick={() => markFromSearch(ticket.id, "present", ticket.status)}><CheckCircle2 className="mr-1 h-3 w-3" /> Prezent</Button>
                    <Button size="sm" variant="outline" className="flex-1" onClick={() => markFromSearch(ticket.id, "late", ticket.status)}><Clock className="mr-1 h-3 w-3" /> Întârziat</Button>
                  </div>
                )}
              </CardContent></Card>
            );
          })}
          {publicSearchResults.map((t: any) => (
            <Card key={t.id}><CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{t.attendee_name}</span>
                  <Badge variant="outline" className="text-xs">Vizitator</Badge>
                </div>
                <Badge variant="secondary" className="text-xs">{statusLabels[t.status]}</Badge>
              </div>
              {t.status === "reserved" && (
                <div className="flex gap-1">
                  <Button size="sm" className="flex-1" onClick={() => markFromSearch(t.id, "present", t.status, true)}><CheckCircle2 className="mr-1 h-3 w-3" /> Prezent</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => markFromSearch(t.id, "late", t.status, true)}><Clock className="mr-1 h-3 w-3" /> Întârziat</Button>
                </div>
              )}
            </CardContent></Card>
          ))}
          {searchResults.length === 0 && publicSearchResults.length === 0 && searchQuery.length >= 2 && (
            <p className="text-sm text-center text-muted-foreground py-4">Niciun participant găsit.</p>
          )}
        </TabsContent>
      </Tabs>

      <AlertDialog open={!!scanResult} onOpenChange={(o) => { if (!o) { setScanResult(null); if (activeTab === "scan") setTimeout(startScanner, 300); } }}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle className="flex items-center gap-2">
              <XCircle className="h-5 w-5 text-destructive" /> Eroare
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              <p>{scanResult?.message}</p>
              {scanResult?.studentName && <p className="font-medium text-foreground">{scanResult.studentName}</p>}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Închide</AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
