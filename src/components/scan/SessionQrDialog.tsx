import { useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { QrCode } from "lucide-react";

/**
 * Afișează codul QR al unei întâlniri de club / zile de voluntariat,
 * pentru ca elevii să își marcheze singuri prezența.
 */
export default function SessionQrDialog({
  value, title,
}: {
  value: string;
  title: string;
}) {
  const [open, setOpen] = useState(false);
  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        <QrCode className="mr-1 h-4 w-4" /> Afișează QR
      </Button>
      <DialogContent className="sm:max-w-sm">
        <DialogHeader><DialogTitle>{title}</DialogTitle></DialogHeader>
        <div className="flex flex-col items-center gap-3 py-2">
          <div className="rounded-lg bg-white p-4">
            <QRCodeSVG value={value} size={240} level="M" />
          </div>
          <p className="text-center text-sm text-muted-foreground">
            Elevii scanează acest cod din aplicație, din „Legitimația mea”.
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
