import { useEffect, useState } from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Download, X } from "lucide-react";
import {
  checkForUpdate,
  dismissUpdateCard,
  isUpdateCardDismissed,
  type AppVersionInfo,
} from "@/lib/app-version";

export function UpdateAvailableCard() {
  const [info, setInfo] = useState<AppVersionInfo | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    let cancelled = false;
    checkForUpdate().then((result) => {
      if (cancelled || !result) return;
      if (isUpdateCardDismissed(result.latestVersion)) return;
      setInfo(result);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  if (!info || dismissed) return null;

  const handleDismiss = () => {
    dismissUpdateCard(info.latestVersion);
    setDismissed(true);
  };

  const handleUpdate = () => {
    if (info.storeUrl) {
      window.open(info.storeUrl, "_blank", "noopener,noreferrer");
    }
  };

  return (
    <Card className="mb-6 border-primary/40 bg-primary/5">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Download className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <p className="text-sm font-semibold">Actualizare disponibilă</p>
          <p className="mt-0.5 text-sm text-muted-foreground">
            O versiune nouă a aplicației este disponibilă. Actualizează pentru
            cele mai recente îmbunătățiri.
          </p>
          {info.storeUrl && (
            <Button size="sm" className="mt-3" onClick={handleUpdate}>
              Actualizează
            </Button>
          )}
        </div>
        <Button
          variant="ghost"
          size="icon"
          className="shrink-0"
          onClick={handleDismiss}
          aria-label="Închide"
        >
          <X className="h-4 w-4" />
        </Button>
      </CardContent>
    </Card>
  );
}
