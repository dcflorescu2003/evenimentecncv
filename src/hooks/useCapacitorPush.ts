import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { PushNotifications } from "@capacitor/push-notifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";

/**
 * Registers the device for FCM push notifications on Android/iOS (Capacitor).
 * Stores the FCM token in the fcm_tokens table.
 * This hook is a no-op on web.
 */
export function useCapacitorPush() {
  const { user } = useAuth();
  const registered = useRef(false);

  useEffect(() => {
    if (!user) return;
    if (!Capacitor.isNativePlatform()) return;
    if (registered.current) return;

    const setup = async () => {
      try {
        let permStatus = await PushNotifications.checkPermissions();
        if (permStatus.receive === "prompt") {
          permStatus = await PushNotifications.requestPermissions();
        }
        if (permStatus.receive !== "granted") {
          console.log("Push permission not granted");
          return;
        }

        await PushNotifications.register();

        PushNotifications.addListener("registration", async (token) => {
          console.log("FCM token:", token.value);
          const platform = Capacitor.getPlatform(); // 'android' | 'ios'
          const { error } = await supabase.from("fcm_tokens" as any).upsert(
            {
              user_id: user.id,
              token: token.value,
              platform,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,token" }
          );
          if (error) console.error("Failed to save FCM token:", error);
        });

        PushNotifications.addListener("registrationError", (err) => {
          console.error("Push registration error:", err);
        });

        PushNotifications.addListener("pushNotificationReceived", (notification) => {
          console.log("Push received:", notification);
        });

        PushNotifications.addListener("pushNotificationActionPerformed", (notification) => {
          console.log("Push action:", notification);
          // Navigate to tickets page when notification is tapped
          const url = notification.notification?.data?.url;
          if (url) {
            window.location.href = url;
          }
        });

        registered.current = true;
      } catch (err) {
        console.error("Capacitor push setup error:", err);
      }
    };

    setup();
  }, [user]);
}
