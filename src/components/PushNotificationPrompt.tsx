import { useState, useEffect } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { BellRing, X } from "lucide-react";

const DISMISS_KEY = "push_prompt_dismissed_at";
const DISMISS_DAYS = 7;

export default function PushNotificationPrompt() {
  const { isSubscribed, isSupported, permission, loading, subscribe } = usePushNotifications();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!isSupported || isSubscribed || permission !== "default") return;
    const dismissed = localStorage.getItem(DISMISS_KEY);
    if (dismissed) {
      const diff = Date.now() - Number(dismissed);
      if (diff < DISMISS_DAYS * 86400000) return;
    }
    const timer = setTimeout(() => setVisible(true), 1500);
    return () => clearTimeout(timer);
  }, [isSupported, isSubscribed, permission]);

  if (!visible) return null;

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, String(Date.now()));
    setVisible(false);
  };

  const handleActivate = async () => {
    await subscribe();
    setVisible(false);
  };

  return (
    <Card className="fixed bottom-16 left-3 right-3 z-40 border-primary/30 shadow-lg animate-in slide-in-from-bottom-4 duration-300">
      <CardContent className="flex items-start gap-3 p-4">
        <div className="rounded-full bg-primary/10 p-2 shrink-0">
          <BellRing className="h-5 w-5 text-primary" />
        </div>
        <div className="flex-1 space-y-2">
          <p className="text-sm font-medium">Activează notificările</p>
          <p className="text-xs text-muted-foreground">
            Primește remindere pe telefon cu o zi înainte de evenimentele tale.
          </p>
          <div className="flex gap-2">
            <Button size="sm" onClick={handleActivate} disabled={loading}>
              Activează
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              Nu acum
            </Button>
          </div>
        </div>
        <button onClick={dismiss} className="shrink-0 text-muted-foreground hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </CardContent>
    </Card>
  );
}
