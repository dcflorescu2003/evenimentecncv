import {
  scanEventTicket, setAttendance, searchEventParticipants, fetchEventRoster, cachedRoster,
  readQueue, writeQueue, localAutoStatus, type RosterEntry, type ParticipantHit,
} from "@/lib/ticket-scan";
import { matchesSearch } from "@/lib/search";
import { useMemo } from "react";
import { RefreshCw, CloudOff } from "lucide-react";
import { useDebouncedValue } from "@/hooks/useDebouncedValue";
import {
  buildQrScannerConfig, cameraDisplayLabel, createQrScanner, initializeQrCameras,
  isFrontCamera, rememberQrCamera, resolveQrCamera,
} from "@/components/scan/QrCameraScanner";
import { formatDate } from "@/lib/time";
import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Slider } from "@/components/ui/slider";
import { Camera as CameraIcon, CameraOff } from "lucide-react";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import {
  AlertDialog, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  ArrowLeft, ScanLine, Keyboard, Search, CheckCircle2, XCircle, Clock,
} from "lucide-react";
import { toast } from "sonner";

type TicketStatus = "present" | "late" | "absent" | "excused";

const statusLabels: Record<string, string> = {
  reserved: "Rezervat", present: "Prezent", late: "Întârziat",
  absent: "Absent", excused: "Motivat", cancelled: "Anulat",
};

export default function EventScanScreen({ eventId, backPath, markNote, readerId }: {
  eventId?: string; backPath: string; markNote: string; readerId: string;
}) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

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
      const initialized = await initializeQrCameras();
      setCameras(initialized.cameras);
      setSelectedCameraId(initialized.selectedId);
      setIsCamsInitialized(true);
    }
    void initCams();
  }, []);

  const { data: event } = useQuery({
    queryKey: ["scan_event", eventId],
    queryFn: async () => {
      const { data, error } = await supabase.from("events").select("*").eq("id", eventId!).single();
      if (error) throw error;
      return data;
    },
    enabled: !!eventId,
  });

  // Lista biletelor evenimentului, descărcată o dată și reîmprospătată periodic.
  const { data: roster, isFetching: rosterLoading, refetch: refetchRoster, dataUpdatedAt } = useQuery({
    queryKey: ["scan_roster", eventId],
    queryFn: () => fetchEventRoster(eventId!),
    enabled: !!eventId,
    initialData: () => (eventId ? cachedRoster(eventId) : undefined),
    initialDataUpdatedAt: 0,
    refetchInterval: 3 * 60_000,
    staleTime: 60_000,
  });
  const rosterMap = useMemo(() => new Map((roster ?? []).map((r) => [r.qr, r])), [roster]);

  // Coada de marcări netrimise (fără internet).
  const [queue, setQueue] = useState<string[]>(() => (eventId ? readQueue(eventId) : []));
  const updateQueue = useCallback((fn: (q: string[]) => string[]) => {
    setQueue((prev) => { const next = fn(prev); if (eventId) writeQueue(eventId, next); return next; });
  }, [eventId]);

  const patchRoster = useCallback((qr: string, status: string) => {
    queryClient.setQueryData<RosterEntry[]>(["scan_roster", eventId], (old) =>
      old?.map((r) => (r.qr === qr ? { ...r, status } : r)));
  }, [queryClient, eventId]);

  const flushQueue = useCallback(async () => {
    if (!eventId) return;
    const items = readQueue(eventId);
    for (const qr of items) {
      const res = await scanEventTicket(eventId, qr);
      if (!res.success && !res.already && res.message?.startsWith("Eroare de conexiune")) return; // tot offline
      updateQueue((q) => q.filter((x) => x !== qr));
      if (res.success && res.status) patchRoster(qr, res.status);
    }
  }, [eventId, updateQueue, patchRoster]);

  useEffect(() => {
    if (queue.length === 0) return;
    const t = setInterval(() => { void flushQueue(); }, 15_000);
    const on = () => { void flushQueue(); };
    window.addEventListener("online", on);
    return () => { clearInterval(t); window.removeEventListener("online", on); };
  }, [queue.length, flushQueue]);

  const debouncedQuery = useDebouncedValue(searchQuery, 300);
  const useLocalSearch = !!roster;
  const { data: serverHits = [], isError: searchError, isFetching: searching } = useQuery({
    queryKey: ["scan_search_participants", eventId, debouncedQuery],
    queryFn: () => searchEventParticipants(eventId!, debouncedQuery),
    enabled: !useLocalSearch && !!eventId && debouncedQuery.trim().length >= 2,
  });
  const hits: ParticipantHit[] = useLocalSearch
    ? (debouncedQuery.trim().length >= 2
        ? (roster ?? []).filter((r) => matchesSearch(debouncedQuery, r.name)).slice(0, 50)
        : [])
    : serverHits;

  const startScanner = useCallback(async (cameraIdOverride?: string) => {
    if (scannerRef.current || !videoRef.current) return;
    try {
      const scanner = await createQrScanner(readerId);
      scannerRef.current = scanner;
      const cId = cameraIdOverride || selectedCameraId;
      const config = resolveQrCamera(cId);
      await scanner.start(
        config,
        (await buildQrScannerConfig(!isFrontCamera(cId, cameras))) as any,
        (decodedText) => handleQrResult(decodedText),
        () => {}
      );
      setScannerActive(true);
      setTimeout(async () => {
        try {
          await scanner.applyVideoConstraints({ advanced: [{ zoom: zoom[0] } as any] });
          setHasZoom(true);
        } catch {
          setHasZoom(false);
        }
      }, 500);
    } catch (err: any) {
      toast.error("Nu s-a putut porni camera: " + (err.message || err));
      scannerRef.current = null;
      setScannerActive(false);
    }
  }, [cameras, selectedCameraId, zoom]);

  const stopScanner = useCallback(async () => {
    if (scannerRef.current) {
      try { await scannerRef.current.stop(); scannerRef.current.clear(); } catch {}
      scannerRef.current = null;
      setScannerActive(false);
    }
  }, []);

  useEffect(() => { return () => { stopScanner(); }; }, [stopScanner]);

  useEffect(() => {
    if (activeTab === "scan" && isCamsInitialized) {
      const t = setTimeout(() => {
        if (!scannerRef.current) startScanner();
      }, 100);
      return () => clearTimeout(t);
    } else { stopScanner(); }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, isCamsInitialized]);

  async function handleQrResult(qrData: string) {
    try { scannerRef.current?.pause(true); } catch { /* scanner deja pus pe pauză */ }
    await processTicket(qrData);
  }

  function resumeScanner() {
    const scanner = scannerRef.current;
    if (!scanner) return;
    try { scanner.resume(); } catch { /* scannerul a fost oprit între timp */ }
  }

  async function processTicket(qrCodeData: string) {
    if (!eventId) { setScanResult({ success: false, message: "Selectează un eveniment înainte de scanare." }); return; }
    if (!qrCodeData) return;
    const res = await scanEventTicket(eventId, qrCodeData);
    if (res.success) {
      toast.success(`✓ ${res.name} — ${statusLabels[res.status ?? ""] ?? res.status}`);
    queryClient.invalidateQueries({ queryKey: ["scan_search_participants"] });
      if (activeTab === "scan") resumeScanner();
      return;
    }
    if (res.already) {
      setScanResult({ success: false, message: `Deja procesat (${statusLabels[res.status ?? ""] ?? res.status}).`, studentName: res.name, ticketId: res.ticket_id, isPublicTicket: res.is_public } as any);
      return;
    }
    setScanResult({ success: false, message: res.message ?? "Bilet negăsit." } as any);
  }

  async function markFromSearch(ticketId: string, status: TicketStatus, _currentStatus: string, isPublic?: boolean) {
    const err = await setAttendance(ticketId, status, isPublic, markNote);
    if (err) { toast.error(err); return; }
    toast.success("Prezență actualizată");
    queryClient.invalidateQueries({ queryKey: ["scan_search_participants"] });
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="icon" onClick={() => navigate(backPath)}>
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
          <div id={readerId} ref={videoRef} className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border bg-muted" style={{ minHeight: 300 }} />
          {cameras.length > 0 && (
            <Select value={selectedCameraId} onValueChange={(val) => {
              setSelectedCameraId(val);
              rememberQrCamera(val);
              if (scannerActive) { stopScanner().then(() => startScanner(val)); }
            }}>
              <SelectTrigger><SelectValue placeholder="Alege camera" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="auto">Automată (Spate)</SelectItem>
                {cameras.map((c, index) => <SelectItem key={c.id} value={c.id}>{cameraDisplayLabel(c, index)}</SelectItem>)}
              </SelectContent>
            </Select>
          )}
          {hasZoom && (
            <div className="flex items-center gap-3 px-2 py-1 border rounded bg-background">
              <span className="text-sm text-muted-foreground w-12">Zoom</span>
              <Slider value={zoom} min={1} max={5} step={0.1} onValueChange={(v) => {
                setZoom(v);
                if (scannerRef.current) scannerRef.current.applyVideoConstraints({ advanced: [{ zoom: v[0] } as any] }).catch(()=>{});
              }} />
            </div>
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
          {hits.map((t) => (
            <Card key={t.ticket_id}><CardContent className="p-3 space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-sm">{t.name}</span>
                  {t.is_public && <Badge variant="outline" className="text-xs">Vizitator</Badge>}
                </div>
                <Badge variant="secondary" className="text-xs">{statusLabels[t.status]}</Badge>
              </div>
              {t.status === "reserved" && (
                <div className="flex gap-1">
                  <Button size="sm" className="flex-1" onClick={() => markFromSearch(t.ticket_id, "present", t.status, t.is_public)}><CheckCircle2 className="mr-1 h-3 w-3" /> Prezent</Button>
                  <Button size="sm" variant="outline" className="flex-1" onClick={() => markFromSearch(t.ticket_id, "late", t.status, t.is_public)}><Clock className="mr-1 h-3 w-3" /> Întârziat</Button>
                </div>
              )}
            </CardContent></Card>
          ))}
          {searchError && <p className="text-sm text-center text-destructive py-4">Eroare de conexiune, încearcă din nou.</p>}
          {!searchError && !searching && hits.length === 0 && debouncedQuery.trim().length >= 2 && (
            <p className="text-sm text-center text-muted-foreground py-4">Niciun participant găsit.</p>
          )}
        </TabsContent>
      </Tabs>

      {/* Scan Result Dialog — only for errors */}
      <AlertDialog open={!!scanResult} onOpenChange={(o) => { if (!o) { setScanResult(null); if (activeTab === "scan") resumeScanner(); } }}>
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
