import { useState, useEffect } from "react";
import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
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
    const timer = setTimeout(() => setVisible(true), 800);
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
    <div className="relative overflow-hidden rounded-xl border border-primary/20 bg-gradient-to-r from-primary/10 via-primary/5 to-accent/10 p-5 animate-in slide-in-from-top-4 duration-500">
      {/* Dismiss button */}
      <button
        onClick={dismiss}
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors"
      >
        <X className="h-4 w-4" />
      </button>

      <div className="flex items-start gap-4">
        {/* Animated bell */}
        <div className="shrink-0 rounded-full bg-primary/15 p-3">
          <BellRing className="h-7 w-7 text-primary animate-wiggle" />
        </div>

        <div className="flex-1 space-y-3">
          <div>
            <p className="text-base font-semibold text-foreground">
              🔔 Activează notificările
            </p>
            <p className="mt-1 text-sm text-muted-foreground">
              Primești un reminder pe telefon cu <strong>o zi înainte</strong> de fiecare eveniment la care ești înscris. Nu vei rata niciun eveniment!
            </p>
          </div>

          <div className="flex items-center gap-3">
            <Button onClick={handleActivate} disabled={loading} size="sm" className="px-5">
              <BellRing className="mr-2 h-4 w-4" />
              {loading ? "Se activează…" : "Activează acum"}
            </Button>
            <button
              onClick={dismiss}
              className="text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              Nu acum
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
