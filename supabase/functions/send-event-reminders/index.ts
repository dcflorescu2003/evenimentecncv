import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Web Push helpers
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

async function importPrivateKey(base64url: string) {
  const raw = urlBase64ToUint8Array(base64url);
  return await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign"]
  );
}

async function importPublicKey(base64url: string) {
  const raw = urlBase64ToUint8Array(base64url);
  return await crypto.subtle.importKey(
    "raw",
    raw,
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["verify"]
  );
}

// Create JWT for VAPID
async function createVapidJwt(audience: string, subject: string, privateKey: CryptoKey): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const enc = new TextEncoder();
  const toBase64Url = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const strToBase64Url = (s: string) =>
    btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const headerB64 = strToBase64Url(JSON.stringify(header));
  const payloadB64 = strToBase64Url(JSON.stringify(payload));
  const unsigned = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign(
    { name: "ECDSA", hash: "SHA-256" },
    privateKey,
    enc.encode(unsigned)
  );

  // Convert DER signature to raw r||s format
  const sigArray = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  if (sigArray.length === 64) {
    r = sigArray.slice(0, 32);
    s = sigArray.slice(32, 64);
  } else {
    // DER format
    let offset = 2;
    const rLen = sigArray[offset + 1];
    offset += 2;
    r = sigArray.slice(offset, offset + rLen);
    offset += rLen;
    const sLen = sigArray[offset + 1];
    offset += 2;
    s = sigArray.slice(offset, offset + sLen);
    // Pad/trim to 32 bytes
    if (r.length > 32) r = r.slice(r.length - 32);
    if (s.length > 32) s = s.slice(s.length - 32);
    if (r.length < 32) { const p = new Uint8Array(32); p.set(r, 32 - r.length); r = p; }
    if (s.length < 32) { const p = new Uint8Array(32); p.set(s, 32 - s.length); s = p; }
  }
  const rawSig = new Uint8Array(64);
  rawSig.set(r, 0);
  rawSig.set(s, 32);

  return `${unsigned}.${toBase64Url(rawSig.buffer)}`;
}

// Send a single push notification
async function sendPushNotification(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: CryptoKey
) {
  try {
    const url = new URL(subscription.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await createVapidJwt(audience, "mailto:noreply@school.local", vapidPrivateKey);

    const response = await fetch(subscription.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream",
        "TTL": "86400",
        "Authorization": `vapid t=${jwt}, k=${vapidPublicKey}`,
      },
      body: new TextEncoder().encode(payload),
    });

    return response.ok || response.status === 201;
  } catch (e) {
    console.error("Push send error:", e);
    return false;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPrivateKeyB64 = Deno.env.get("VAPID_PRIVATE_KEY")!;
    const vapidPublicKey = "BJZcOwgP8NBFeqVTMiHpUqZWOH2kIy0hqomcRauEZgF2Hd5KdLa6yZ2KaDNddr7xO_BRs3W4BMzH15CahNwvaWk";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get tomorrow's date
    const tomorrow = new Date();
    tomorrow.setDate(tomorrow.getDate() + 1);
    const tomorrowStr = tomorrow.toISOString().split("T")[0];

    // Find events happening tomorrow with active reservations
    const { data: tomorrowEvents, error: evErr } = await supabase
      .from("events")
      .select("id, title, date, start_time, end_time, location")
      .eq("date", tomorrowStr)
      .eq("status", "published")
      .eq("published", true);

    if (evErr) throw evErr;
    if (!tomorrowEvents || tomorrowEvents.length === 0) {
      return new Response(JSON.stringify({ message: "No events tomorrow" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventIds = tomorrowEvents.map((e: any) => e.id);

    // Get all active reservations for tomorrow's events
    const { data: reservations, error: resErr } = await supabase
      .from("reservations")
      .select("student_id, event_id")
      .in("event_id", eventIds)
      .eq("status", "reserved");

    if (resErr) throw resErr;
    if (!reservations || reservations.length === 0) {
      return new Response(JSON.stringify({ message: "No reservations for tomorrow" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Build event map
    const eventMap: Record<string, any> = {};
    for (const e of tomorrowEvents) eventMap[e.id] = e;

    // Group by student
    const studentEvents: Record<string, string[]> = {};
    for (const r of reservations) {
      if (!studentEvents[r.student_id]) studentEvents[r.student_id] = [];
      studentEvents[r.student_id].push(r.event_id);
    }

    const studentIds = Object.keys(studentEvents);

    // Check which notifications already exist (avoid duplicates)
    const { data: existingNotifs } = await supabase
      .from("notifications")
      .select("user_id, related_event_id")
      .in("user_id", studentIds)
      .in("related_event_id", eventIds)
      .eq("type", "event_reminder");

    const existingSet = new Set(
      (existingNotifs || []).map((n: any) => `${n.user_id}_${n.related_event_id}`)
    );

    // Create in-app notifications
    const notificationsToInsert: any[] = [];
    for (const studentId of studentIds) {
      for (const eventId of studentEvents[studentId]) {
        if (existingSet.has(`${studentId}_${eventId}`)) continue;
        const ev = eventMap[eventId];
        notificationsToInsert.push({
          user_id: studentId,
          title: "Reminder: Eveniment mâine",
          body: `${ev.title} • ${ev.start_time?.slice(0, 5)} – ${ev.end_time?.slice(0, 5)}${ev.location ? ` • ${ev.location}` : ""}`,
          type: "event_reminder",
          related_event_id: eventId,
        });
      }
    }

    let insertedCount = 0;
    if (notificationsToInsert.length > 0) {
      const { error: insErr } = await supabase
        .from("notifications")
        .insert(notificationsToInsert);
      if (insErr) console.error("Insert notifications error:", insErr);
      else insertedCount = notificationsToInsert.length;
    }

    // Send push notifications
    let pushCount = 0;
    try {
      const vapidPrivateKey = await importPrivateKey(vapidPrivateKeyB64);

      const { data: subscriptions } = await supabase
        .from("push_subscriptions")
        .select("*")
        .in("user_id", studentIds);

      if (subscriptions && subscriptions.length > 0) {
        for (const sub of subscriptions) {
          const events = studentEvents[sub.user_id] || [];
          if (events.length === 0) continue;

          const evNames = events.map((eid: string) => eventMap[eid]?.title).filter(Boolean);
          const pushPayload = JSON.stringify({
            title: "Reminder: Eveniment mâine",
            body: evNames.length === 1
              ? evNames[0]
              : `Ai ${evNames.length} evenimente mâine`,
            icon: "/favicon.ico",
            data: { url: "/student/tickets" },
          });

          const ok = await sendPushNotification(sub, pushPayload, vapidPublicKey, vapidPrivateKey);
          if (ok) pushCount++;
        }
      }
    } catch (pushErr) {
      console.error("Push notifications error:", pushErr);
    }

    return new Response(
      JSON.stringify({
        message: `Created ${insertedCount} notifications, sent ${pushCount} push notifications`,
        events: tomorrowEvents.length,
        students: studentIds.length,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: error.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
