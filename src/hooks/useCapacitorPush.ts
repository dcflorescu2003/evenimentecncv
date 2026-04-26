import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { FirebaseMessaging } from "@capacitor-firebase/messaging";
import { LocalNotifications } from "@capacitor/local-notifications";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

/**
 * Registers the device for FCM push notifications on Android/iOS (Capacitor).
 * Uses @capacitor-firebase/messaging so we get an FCM token on BOTH platforms
 * (on iOS, the underlying APNs token is exchanged for an FCM token by Firebase SDK).
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
        // 1. Cere permisiune pentru push
        let perm = await FirebaseMessaging.checkPermissions();
        if (perm.receive === "prompt" || perm.receive === "prompt-with-rationale") {
          perm = await FirebaseMessaging.requestPermissions();
        }
        if (perm.receive !== "granted") {
          console.log("Push permission not granted");
          toast("Notificările sunt dezactivate", {
            description: "Activează permisiunea din sistem dacă vrei remindere pentru evenimente.",
          });
          return;
        }

        // 2. Permisiune + canal pentru notificări locale (foreground fallback Android)
        try {
          const localPerm = await LocalNotifications.checkPermissions();
          if (localPerm.display === "prompt") {
            await LocalNotifications.requestPermissions();
          }
          if (Capacitor.getPlatform() === "android") {
            await LocalNotifications.createChannel({
              id: "default",
              name: "Notificări",
              description: "Notificări evenimente",
              importance: 5,
              visibility: 1,
              sound: "default",
              vibration: true,
            });
          }
        } catch (e) {
          console.warn("LocalNotifications setup warning:", e);
        }

        // 3. Listener pentru token FCM (același format pe Android și iOS)
        await FirebaseMessaging.addListener("tokenReceived", async ({ token }) => {
          console.log("FCM token:", token);
          const platform = Capacitor.getPlatform(); // 'android' | 'ios'
          const { error } = await supabase.from("fcm_tokens").upsert(
            {
              user_id: user.id,
              token,
              platform,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,token" }
          );
          if (error) console.error("Failed to save FCM token:", error);
        });

        // 4. Notificare primită în foreground
        await FirebaseMessaging.addListener("notificationReceived", async (event) => {
          console.log("Push received (foreground):", event);
          const notification = event.notification;
          const title = notification?.title || "Notificare";
          const body = notification?.body || "";
          const data = (notification?.data ?? {}) as Record<string, unknown>;
          const url = data.url as string | undefined;

          // În foreground, sistemul nu afișează automat notificarea — o afișăm local
          try {
            await LocalNotifications.schedule({
              notifications: [
                {
                  id: Math.floor(Math.random() * 2_000_000_000),
                  title,
                  body,
                  channelId: Capacitor.getPlatform() === "android" ? "default" : undefined,
                  smallIcon: "ic_launcher",
                  extra: { url: url || "/student/tickets" },
                },
              ],
            });
          } catch (e) {
            console.warn("LocalNotifications.schedule failed:", e);
          }

          toast(title, {
            description: body,
            action: url
              ? {
                  label: "Deschide",
                  onClick: () => {
                    window.location.href = String(url);
                  },
                }
              : undefined,
          });
        });

        // 5. Tap pe notificare push (background/closed)
        await FirebaseMessaging.addListener("notificationActionPerformed", (event) => {
          console.log("Push action:", event);
          const data = (event.notification?.data ?? {}) as Record<string, unknown>;
          const url = data.url as string | undefined;
          if (url) {
            window.location.href = url;
          }
        });

        // 6. Tap pe notificarea locală (foreground)
        try {
          await LocalNotifications.addListener("localNotificationActionPerformed", (action) => {
            const url = action.notification?.extra?.url;
            if (url) window.location.href = String(url);
          });
        } catch (e) {
          console.warn("LocalNotifications listener warning:", e);
        }

        // 7. Obține token-ul (pe iOS asta declanșează și înregistrarea APNs)
        const { token } = await FirebaseMessaging.getToken();
        if (token) {
          console.log("FCM token (initial):", token);
          const platform = Capacitor.getPlatform();
          await supabase.from("fcm_tokens").upsert(
            {
              user_id: user.id,
              token,
              platform,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "user_id,token" }
          );
        }

        registered.current = true;
      } catch (err) {
        console.error("Capacitor push setup error:", err);
      }
    };

    setup();

    return () => {
      void FirebaseMessaging.removeAllListeners();
      registered.current = false;
    };
  }, [user]);
}
