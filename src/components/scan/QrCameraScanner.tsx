import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera as CameraIcon, CameraOff } from "lucide-react";
import { Camera } from "@capacitor/camera";
import { toast } from "sonner";

let domIdCounter = 0;

/**
 * Configurație comună, optimizată pentru viteză:
 * - doar coduri QR (fără alte formate de coduri de bare);
 * - fără decodare oglindită (disableFlip);
 * - fps mai mare — costul per cadru e mult mai mic cu optimizările de mai sus.
 */
export async function buildQrScannerConfig() {
  const { Html5QrcodeSupportedFormats } = await import("html5-qrcode");
  return {
    fps: 20,
    qrbox: { width: 250, height: 250 },
    aspectRatio: 1.333334,
    disableFlip: true,
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    videoConstraints: { width: { ideal: 1280 }, height: { ideal: 720 } },
  } as const;
}

/**
 * Scanner QR reutilizabil (cluburi, voluntariat, legitimații).
 * Apelează onScan pentru fiecare cod citit; scanarea continuă imediat pentru
 * un cod diferit, iar același cod este ignorat pe durata pauseMs (anti-duplicat).
 */
export default function QrCameraScanner({
  onScan,
  autoStart = true,
  pauseMs = 800,
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
  const lastScanRef = useRef<{ text: string; at: number } | null>(null);
  const onScanRef = useRef(onScan);
  const pauseRef = useRef(pauseMs);
  onScanRef.current = onScan;
  pauseRef.current = pauseMs;

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
      const scanConfig = await buildQrScannerConfig();
      await scanner.start(
        config as any,
        scanConfig as any,
        (decoded: string) => {
          // Anti-duplicat: același cod e ignorat pe durata pauseMs,
          // dar un cod diferit trece imediat (flux continuu la rând de elevi).
          const last = lastScanRef.current;
          if (last && last.text === decoded && Date.now() - last.at < pauseRef.current) return;
          if (busyRef.current) return;
          lastScanRef.current = { text: decoded, at: Date.now() };
          busyRef.current = true;
          void Promise.resolve(onScanRef.current(decoded))
            .catch(() => { /* erorile sunt afișate de handler */ })
            .finally(() => { busyRef.current = false; });
        },
        () => {},
      );
      setActive(true);
    } catch (err: any) {
      toast.error("Eroare cameră: " + (err?.message || err));
      scannerRef.current = null;
      setActive(false);
    }
  }, [domId, selectedCameraId]);

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
