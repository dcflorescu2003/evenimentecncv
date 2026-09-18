import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Camera as CameraIcon, CameraOff } from "lucide-react";
import { Camera } from "@capacitor/camera";
import { toast } from "sonner";

let domIdCounter = 0;
const CAMERA_STORAGE_KEY = "cncv-qr-camera-id";
const BACK_CAMERA_PATTERN = /back|rear|environment|spate|traseira|arrière|rück|posterior/i;
const FRONT_CAMERA_PATTERN = /front|user|față|fata|frontal/i;

export type QrCameraDevice = { id: string; label: string };

export function isFrontCamera(cameraId: string, cameras: QrCameraDevice[]) {
  const camera = cameras.find((item) => item.id === cameraId);
  return FRONT_CAMERA_PATTERN.test(camera?.label ?? "");
}

export function cameraDisplayLabel(camera: QrCameraDevice, index: number) {
  if (BACK_CAMERA_PATTERN.test(camera.label)) return `Camera spate${camera.label ? ` · ${camera.label}` : ""}`;
  if (FRONT_CAMERA_PATTERN.test(camera.label)) return `Camera față${camera.label ? ` · ${camera.label}` : ""}`;
  return camera.label || `Camera ${index + 1}`;
}

export function rememberQrCamera(cameraId: string) {
  try { localStorage.setItem(CAMERA_STORAGE_KEY, cameraId); } catch { /* indisponibil */ }
}

export async function initializeQrCameras(): Promise<{ cameras: QrCameraDevice[]; selectedId: string }> {
  try {
    let status = await Camera.checkPermissions();
    if (status.camera !== "granted") status = await Camera.requestPermissions();
    if (status.camera !== "granted") return { cameras: [], selectedId: "auto" };
  } catch {
    /* Pe web, permisiunea este cerută de getUserMedia. */
  }

  try {
    const { Html5Qrcode } = await import("html5-qrcode");
    const cameras = (await Html5Qrcode.getCameras()) ?? [];
    let savedId = "";
    try { savedId = localStorage.getItem(CAMERA_STORAGE_KEY) ?? ""; } catch { /* indisponibil */ }
    if (savedId && cameras.some((camera) => camera.id === savedId)) return { cameras, selectedId: savedId };
    const rear = [...cameras].reverse().find((camera) => BACK_CAMERA_PATTERN.test(camera.label));
    const selectedId = rear?.id ?? cameras.at(-1)?.id ?? "auto";
    return { cameras, selectedId };
  } catch {
    return { cameras: [], selectedId: "auto" };
  }
}

export function resolveQrCamera(cameraId: string) {
  return cameraId && cameraId !== "auto" ? cameraId : { facingMode: "environment" };
}

export async function createQrScanner(domId: string) {
  const { Html5Qrcode, Html5QrcodeSupportedFormats } = await import("html5-qrcode");
  return new Html5Qrcode(domId, {
    formatsToSupport: [Html5QrcodeSupportedFormats.QR_CODE],
    useBarCodeDetectorIfSupported: true,
    verbose: false,
  } as any);
}

/**
 * Configurație comună, optimizată pentru viteză:
 * - doar coduri QR (fără alte formate de coduri de bare);
 * - fără decodare oglindită (disableFlip);
 * - frecvență echilibrată pentru telefoane, cu zonă de scanare adaptivă.
 */
export async function buildQrScannerConfig(disableFlip = true) {
  return {
    fps: 12,
    qrbox: (viewfinderWidth: number, viewfinderHeight: number) => {
      const size = Math.floor(Math.min(viewfinderWidth, viewfinderHeight) * 0.78);
      return { width: size, height: size };
    },
    disableFlip,
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
  const [cameras, setCameras] = useState<QrCameraDevice[]>([]);
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
      const initialized = await initializeQrCameras();
      setCameras(initialized.cameras);
      setSelectedCameraId(initialized.selectedId);
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
      const scanner = await createQrScanner(domId);
      scannerRef.current = scanner;
      const cId = cameraOverride || selectedCameraId;
      const config = resolveQrCamera(cId);
      const scanConfig = await buildQrScannerConfig(!isFrontCamera(cId, cameras));
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
  }, [cameras, domId, selectedCameraId]);

  useEffect(() => {
    if (ready && autoStart) {
      const t = setTimeout(() => { if (!scannerRef.current) start(); }, 100);
      return () => clearTimeout(t);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, autoStart]);

  useEffect(() => () => { stop(); }, [stop]);

  return (
    <div className="space-y-3">
      <div id={domId} className="mx-auto w-full max-w-sm overflow-hidden rounded-lg border bg-muted" style={{ minHeight: 260 }} />
      {cameras.length > 1 && (
        <Select value={selectedCameraId} onValueChange={(cameraId) => {
          setSelectedCameraId(cameraId);
          rememberQrCamera(cameraId);
          if (active) void stop().then(() => start(cameraId));
        }}>
          <SelectTrigger><SelectValue placeholder="Alege camera" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="auto">Automată (spate)</SelectItem>
            {cameras.map((c, index) => (
              <SelectItem key={c.id} value={c.id}>{cameraDisplayLabel(c, index)}</SelectItem>
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
