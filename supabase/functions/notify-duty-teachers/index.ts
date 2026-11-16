import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { authenticateCronRequest } from "../_shared/cron-auth.ts";
import { reminderContext, dutyRecipients, dutyNotificationId } from "../_shared/duty-reminder.ts";
import { getAccessToken, sendFcmNotification, importPrivateKey, sendWebPush, type ServiceAccount } from "./push.ts";

const respond = (data: unknown, status = 200) => new Response(JSON.stringify(data), {
  status, headers: { ...corsHeaders, "Content-Type": "application/json" },
});

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  const denied = authenticateCronRequest(req);
  if (denied) return new Response(denied.body, { status: denied.status, headers: corsHeaders });
  if (req.method !== "POST") return respond({ error: "Method not allowed" }, 405);
  try {
    const body = await req.json();
    if (!body || typeof body !== "object" || Array.isArray(body) ||
      Object.keys(body).some((key) => key !== "dry_run") ||
      (body.dry_run !== undefined && typeof body.dry_run !== "boolean")) {
      return respond({ error: "Invalid request" }, 400);
    }
    const url = Deno.env.get("SUPABASE_URL");
    const key = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!url || !key) throw new Error("Missing runtime configuration");
    const db = createClient(url, key);
    const { data: settings, error: settingsError } = await db.from("duty_settings").select("anchor_monday").eq("id", true).single();
    if (settingsError) throw settingsError;
    const context = reminderContext(new Date(), settings.anchor_monday);
    // Two UTC callbacks cover summer/winter; only the one at 15:00 local sends.
    if (!context.due && !body.dry_run) return respond({ skipped: true, reason: "Outside reminder time", date: context.date });
    const { data: rows, error: rowsError } = await db.from("duty_schedule")
      .select("week_slot,weekday,shift,teacher_id").eq("week_slot", context.weekSlot).eq("weekday", context.weekday).not("teacher_id", "is", null);
    if (rowsError) throw rowsError;
    const recipients = dutyRecipients(rows ?? [], context);
    if (body.dry_run) return respond({ dry_run: true, ...context, recipients: recipients.size, shifts: [...recipients.values()].map((s) => [...s]) });
    let created = 0;
    let duplicates = 0;
    let pushSent = 0;
    let pushFailures = 0;
    const firebaseJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY");
    let firebase: ServiceAccount | undefined;
    let fcmAccess: string | undefined;
    const vapid = Deno.env.get("VAPID_PRIVATE_KEY");
    let vapidKey: CryptoKey | undefined;
    try {
      if (firebaseJson) { firebase = JSON.parse(firebaseJson); if (firebase) fcmAccess = await getAccessToken(firebase); }
    } catch { console.error("Duty reminders: FCM setup failed"); pushFailures++; }
    try { if (vapid) vapidKey = await importPrivateKey(vapid); }
    catch { console.error("Duty reminders: web push setup failed"); pushFailures++; }
    for (const [teacher, shifts] of recipients) {
      const id = await dutyNotificationId(teacher, context.date);
      const title = "Profesor de serviciu mâine";
      const shiftText = [shifts.has("morning") ? "dimineața" : "", shifts.has("afternoon") ? "după-amiaza" : ""].filter(Boolean).join(" și ");
      const message = `Mâine, ${context.date.split("-").reverse().join(".")}, ești profesor de serviciu ${shiftText}.`;
      const { error } = await db.from("notifications").insert({ id, user_id: teacher, title, body: message, type: "duty_reminder" });
      if (error?.code === "23505") { duplicates++; continue; }
      if (error) throw error;
      created++;
      const { data: tokens, error: tokensError } = await db.from("fcm_tokens").select("id,token").eq("user_id", teacher);
      if (tokensError) { pushFailures++; continue; }
      if (firebase && fcmAccess) for (const token of tokens ?? []) {
        const result = await sendFcmNotification(fcmAccess, firebase.project_id, token.token, title, message, { url: "/prof/orar" });
        if (result.ok) pushSent++; else pushFailures++;
        if (result.invalid) await db.from("fcm_tokens").delete().eq("id", token.id);
      }
      if (vapidKey) {
        const { data: subscriptions, error: subsError } = await db.from("push_subscriptions").select("id,endpoint,p256dh,auth_key").eq("user_id", teacher);
        if (subsError) { pushFailures++; continue; }
        for (const subscription of subscriptions ?? []) {
          const result = await sendWebPush(subscription, JSON.stringify({ title, body: message, icon: "/favicon.ico", data: { url: "/prof/orar" } }),
            "BJZcOwgP8NBFeqVTMiHpUqZWOH2kIy0hqomcRauEZgF2Hd5KdLa6yZ2KaDNddr7xO_BRs3W4BMzH15CahNwvaWk", vapidKey);
          if (result.ok) pushSent++; else pushFailures++;
          if (result.invalid) await db.from("push_subscriptions").delete().eq("id", subscription.id);
        }
      }
    }
    return respond({ date: context.date, created, duplicates, pushSent, pushFailures });
  } catch (error) {
    console.error("Duty reminders failed", error);
    return respond({ error: "Nu s-au putut trimite notificările profesorilor de serviciu." }, 500);
  }
});