import { useCallback, useEffect, useRef, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScanLine, WifiOff, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import QrCameraScanner from "@/components/scan/QrCameraScanner";
import cncvLogo from "@/assets/cncv-logo.jpg";

const statusLabel: Record<string, string> = { present: "Prezent", late: "Întârziat" };
const REFRESH_MS = 20_000;

export default function StudentBadgePage() {
  const { user, profile } = useAuth();
  const [scanOpen, setScanOpen] = useState(false);
  const [token, setToken] = useState<string | null>(null);
  const [expiresAt, setExpiresAt] = useState<number>(0);
  const [issuedAt, setIssuedAt] = useState<number>(0);
  const [offline, setOffline] = useState(false);
  const [genError, setGenError] = useState<string | null>(null);
  const [, setTick] = useState(0);
  const issuing = useRef(false);

  const issue = useCallback(async () => {
    if (issuing.current) return;
    issuing.current = true;
    try {
      const { data, error } = await supabase.rpc("issue_student_qr" as any);
      const res = (data ?? {}) as any;
      if (error || !res?.success) {
        setOffline(navigator.onLine === false);
        setGenError(navigator.onLine === false ? null : "Codul nu a putut fi generat. Reîncearcă.");
        return;
      }
      setToken(res.token as string);
      setExpiresAt(new Date(res.expires_at as string).getTime());
      setIssuedAt(Date.now());
      setOffline(false);
      setGenError(null);
    } catch {
      setOffline(navigator.onLine === false);
      setGenError(navigator.onLine === false ? null : "Codul nu a putut fi generat. Reîncearcă.");
    } finally {
      issuing.current = false;
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    void issue();
    const interval = setInterval(() => { void issue(); }, REFRESH_MS);
    const onVisible = () => { if (document.visibilityState === "visible") void issue(); };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      clearInterval(interval);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [user, issue]);

  // ceas pentru numărătoarea inversă
  useEffect(() => {
    const t = setInterval(() => setTick((v) => v + 1), 250);
    return () => clearInterval(t);
  }, []);

  const { data: className } = useQuery({
    queryKey: ["my-class", user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data } = await supabase
        .from("student_class_assignments")
        .select("classes(display_name)")
        .eq("student_id", user!.id)
        .order("academic_year", { ascending: false })
        .limit(1)
        .maybeSingle();
      return (data as any)?.classes?.display_name ?? null;
    },
  });

  const now = Date.now();
  const msLeft = Math.max(0, expiresAt - now);
  const secondsLeft = Math.ceil(msLeft / 1000);
  const total = Math.max(1, expiresAt - issuedAt);
  const progress = Math.min(1, Math.max(0, msLeft / total));
  const expired = !!token && msLeft <= 0;
  const badgeValue = token ? `CNCV-STU2:${token}` : "";

  const R = 26;
  const C = 2 * Math.PI * R;

  async function handleMeetingScan(code: string) {
    const club = await supabase.rpc("self_checkin_club" as any, { _qr_code_data: code } as any);
    let res = (club.data ?? {}) as any;
    if (!club.error && res?.success) {
      toast.success(`✓ ${res.name} — ${statusLabel[res.status] ?? res.status}`);
      setScanOpen(false);
      return;
    }
    const vol = await supabase.rpc("self_checkin_volunteer" as any, { _qr_code_data: code } as any);
    const volRes = (vol.data ?? {}) as any;
    if (!vol.error && volRes?.success) {
      toast.success(`✓ ${volRes.name} — ${statusLabel[volRes.status] ?? volRes.status}`);
      setScanOpen(false);
      return;
    }
    const message = volRes?.message === "Cod QR necunoscut."
      ? (res?.message ?? volRes?.message)
      : (volRes?.message ?? res?.message ?? club.error?.message ?? vol.error?.message);
    toast.error(message || "Nu am putut marca prezența.");
  }

  return (
    <div className="mx-auto max-w-md space-y-4">
      <h1 className="font-display text-xl font-bold">Legitimația mea</h1>

      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-6">
          <div className="text-center">
            <p className="font-medium">{profile?.display_name ?? `${profile?.last_name ?? ""} ${profile?.first_name ?? ""}`}</p>
            {className && <p className="text-sm text-muted-foreground">Clasa {className}</p>}
          </div>

          <div className="relative rounded-xl bg-white p-4 shadow-sm">
            {badgeValue && !expired ? (
              <>
                <div
                  key={token}
                  className="animate-qr-pop overflow-hidden rounded-md"
                  style={{ opacity: 0.35 + 0.65 * progress }}
                >
                  <QRCodeSVG value={badgeValue} size={240} level="H" fgColor="#7A1F2E" imageSettings={{ src: cncvLogo, height: 44, width: 44, excavate: true }} />
                </div>
                <div className="pointer-events-none absolute inset-4 overflow-hidden rounded-md">
                  <div className="animate-qr-sweep absolute inset-x-0 h-16 bg-gradient-to-b from-transparent via-primary/20 to-transparent" />
                </div>
              </>
            ) : (
              <div className="flex h-[240px] w-[240px] flex-col items-center justify-center gap-2 text-center text-sm text-muted-foreground">
                {offline ? (
                  <>
                    <WifiOff className="h-6 w-6" />
                    <span>Reconectează-te pentru a genera un cod nou</span>
                  </>
                ) : genError ? (
                  <>
                    <RefreshCw className="h-6 w-6" />
                    <span>{genError}</span>
                  </>
                ) : (
                  <>
                    <RefreshCw className="h-6 w-6 animate-spin" />
                    <span>Se generează codul…</span>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="flex flex-col items-center gap-2">
            <svg width="64" height="64" viewBox="0 0 64 64" className="-rotate-90">
              <circle cx="32" cy="32" r={R} className="fill-none stroke-muted" strokeWidth="5" />
              <circle
                cx="32" cy="32" r={R}
                className="fill-none stroke-primary transition-[stroke-dashoffset] duration-200 ease-linear"
                strokeWidth="5"
                strokeLinecap="round"
                strokeDasharray={C}
                strokeDashoffset={C * (1 - progress)}
              />
            </svg>
            <button
              type="button"
              className="text-sm text-muted-foreground underline underline-offset-2"
              onClick={() => void issue()}
            >
              Generează cod nou
            </button>
          </div>

          <p className="text-center text-sm text-muted-foreground">
            Codul se schimbă automat. Arată codul coordonatorului la club sau la voluntariat pentru a-ți marca prezența.
          </p>
        </CardContent>
      </Card>

      <Button className="w-full" variant="outline" onClick={() => setScanOpen(true)}>
        <ScanLine className="mr-2 h-4 w-4" /> Scanează QR-ul întâlnirii
      </Button>

      <Dialog open={scanOpen} onOpenChange={setScanOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader><DialogTitle>Scanează QR-ul întâlnirii</DialogTitle></DialogHeader>
          {scanOpen && <QrCameraScanner onScan={handleMeetingScan} />}
        </DialogContent>
      </Dialog>
    </div>
  );
}
