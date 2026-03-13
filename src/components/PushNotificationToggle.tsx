import { usePushNotifications } from "@/hooks/usePushNotifications";
import { Button } from "@/components/ui/button";
import { BellRing, BellOff } from "lucide-react";

export default function PushNotificationToggle() {
  const { isSubscribed, isSupported, loading, subscribe, unsubscribe } = usePushNotifications();

  if (!isSupported) return null;

  return (
    <Button
      variant="ghost"
      size="icon"
      onClick={isSubscribed ? unsubscribe : subscribe}
      disabled={loading}
      title={isSubscribed ? "Dezactivează notificările push" : "Activează notificările push"}
    >
      {isSubscribed ? (
        <BellRing className="h-4 w-4 text-primary" />
      ) : (
        <BellOff className="h-4 w-4 text-muted-foreground" />
      )}
    </Button>
  );
}
