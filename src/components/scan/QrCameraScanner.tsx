import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera as CameraIcon, CameraOff } from "lucide-react";
import { Camera } from "@capacitor/camera";
import { toast } from "sonner";

let domIdCounter = 0;

/**
 * Scanner QR reutilizabil (cluburi, voluntariat, legitimații).
 * Apelează onScan pentru fiecare cod citit; scanarea continuă după un scurt
 * interval de pauză pentru a evita citirile duplicate.
 */
export default function QrCameraScanner({
  onScan,
  autoStart = true,
  pauseMs = 1500,
}: {
  onScan: (text: string) => void | Promise<void>;
  autoStart?: boolean;
  pauseMs?: number;
}) {
  const [domId] = useState(() => `qr-reader-${++domIdCounter}`);
  const [cameras, setCameras] = useState<{ id: string; label: string }[]>([]);
  const [selectedCameraId, setSelectedCameraId] = useState("auto");
  const [active, setActive] = useState(false);
  const [ready, setReady] = useState(false);
  const scannerRef = useRef<any>(null);
  const busyRef = useRef(false);
  const onScanRef = useRef(onScan);
  onScanRef.current = onScan;

  useEffect(() => {
    (async () => {
      try {
        let status = await Camera.checkPermissions();
        if (status.camera !== "granted") status = await Camera.requestPermissions();
      } catch {
        /* web: permisiunea se cere la pornirea camerei */
      }
      try {
        const { Html5Qrcode } = await import("html5-qrcode");
        const devices = await Html5Qrcode.getCameras();
        if (devices?.length) setCameras(devices);
      } catch {
        /* fără listă de camere, folosim camera implicită */
      }
      setReady(true);
    })();
  }, []);

  const stop = useCallback(async () => {
    const scanner = scannerRef.current;
    scannerRef.current = null;
    if (scanner) {
      try {
        if (scanner.isScanning) await scanner.stop();
        scanner.clear();
      } catch {
        /* scanner deja oprit */
      }
    }
    setActive(false);
  }, []);

  const start = useCallback(async (cameraOverride?: string) => {
    if (scannerRef.current) return;
    try {
      const { Html5Qrcode } = await import("html5-qrcode");
      const scanner = new Html5Qrcode(domId);
      scannerRef.current = scanner;
      const cId = cameraOverride || selectedCameraId;
      const config = cId && cId !== "auto" ? cId : { facingMode: "environment" };
      await scanner.start(
        config as any,
        { fps: 10, qrbox: { width: 250, height: 250 } },
        async (decoded: string) => {
          if (busyRef.current) return;
          busyRef.current = true;
          try {
            await onScanRef.current(decoded);
          } finally {
            setTimeout(() => { busyRef.current = false; }, pauseMs);
          }
        },
        () => {},
      );
      setActive(true);
    } catch (err: any) {
      toast.error("Eroare cameră: " + (err?.message || err));
      scannerRef.current = null;
      setActive(false);
    }
  }, [domId, pauseMs, selectedCameraId]);

  useEffect(() => {
    if (ready && autoStart) {
      const t = setTimeout(() => { if (!scannerRef.current) start(); }, 300);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, autoStart]);

  useEffect(() => () => { stop(); }, [stop]);

  return (
    <div className="space-y-3">
      <div id={domId} className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border bg-muted" style={{ minHeight: 260 }} />
      {!active && cameras.length > 1 && (
        <Select value={selectedCameraId} onValueChange={setSelectedCameraId}>
          <SelectTrigger><SelectValue placeholder="Alege camera" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Automată (spate)</SelectItem>
            {cameras.map((c) => (
              <SelectItem key={c.id} value={c.id}>{c.label || "Cameră " + c.id}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      )}
      {active ? (
        <Button variant="outline" className="w-full" onClick={stop}>
          <CameraOff className="mr-2 h-4 w-4" /> Oprește camera
        </Button>
      ) : (
        <Button className="w-full" onClick={() => start()}>
          <CameraIcon className="mr-2 h-4 w-4" /> Pornește camera
        </Button>
      )}
    </div>
  );
}
