import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { ScanLine } from "lucide-react";
import { toast } from "sonner";
import QrCameraScanner from "@/components/scan/QrCameraScanner";

const statusLabel: Record<string, string> = { present: "Prezent", late: "Întârziat" };

export default function StudentBadgePage() {
  const { user, profile } = useAuth();
  const [scanOpen, setScanOpen] = useState(false);

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

  const badgeValue = user ? `CNCV-STU:${user.id}` : "";

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
          <div className="rounded-xl bg-white p-4">
            {badgeValue && <QRCodeSVG value={badgeValue} size={240} level="M" />}
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Arată acest cod coordonatorului la club sau la voluntariat pentru a-ți marca prezența.
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
