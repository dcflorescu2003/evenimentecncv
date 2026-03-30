import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// ── FCM v1 helpers ──────────────────────────────────────────────────────

interface ServiceAccount {
  client_email: string;
  private_key: string;
  project_id: string;
  token_uri: string;
}

function base64url(data: Uint8Array): string {
  return btoa(String.fromCharCode(...data))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

function strToBase64url(s: string): string {
  return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function getAccessToken(sa: ServiceAccount): Promise<string> {
  const header = strToBase64url(JSON.stringify({ alg: "RS256", typ: "JWT" }));
  const now = Math.floor(Date.now() / 1000);
  const claimSet = {
    iss: sa.client_email,
    scope: "https://www.googleapis.com/auth/firebase.messaging",
    aud: sa.token_uri,
    iat: now,
    exp: now + 3600,
  };
  const payload = strToBase64url(JSON.stringify(claimSet));
  const unsigned = `${header}.${payload}`;

  // Import RSA private key
  const pemBody = sa.private_key
    .replace(/-----BEGIN PRIVATE KEY-----/, "")
    .replace(/-----END PRIVATE KEY-----/, "")
    .replace(/\n/g, "");
  const keyData = Uint8Array.from(atob(pemBody), (c) => c.charCodeAt(0));
  const privateKey = await crypto.subtle.importKey(
    "pkcs8", keyData,
    { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" },
    false, ["sign"]
  );

  const sig = await crypto.subtle.sign(
    "RSASSA-PKCS1-v1_5", privateKey,
    new TextEncoder().encode(unsigned)
  );
  const jwt = `${unsigned}.${base64url(new Uint8Array(sig))}`;

  const resp = await fetch(sa.token_uri, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: `grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer&assertion=${jwt}`,
  });
  const json = await resp.json();
  if (!resp.ok) throw new Error(`Token error: ${JSON.stringify(json)}`);
  return json.access_token;
}

async function sendFcmNotification(
  accessToken: string,
  projectId: string,
  deviceToken: string,
  title: string,
  body: string,
  data?: Record<string, string>
): Promise<boolean> {
  try {
    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title, body },
            data: data || {},
            android: {
              priority: "high",
              notification: { click_action: "FLUTTER_NOTIFICATION_CLICK" },
            },
          },
        }),
      }
    );
    if (!resp.ok) {
      const err = await resp.text();
      console.error("FCM send error:", resp.status, err);
      return false;
    }
    return true;
  } catch (e) {
    console.error("FCM send exception:", e);
    return false;
  }
}

// ── Web Push helpers (existing) ─────────────────────────────────────────

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  return new Uint8Array([...rawData].map((c) => c.charCodeAt(0)));
}

async function importPrivateKey(base64url: string) {
  const raw = urlBase64ToUint8Array(base64url);
  return await crypto.subtle.importKey("raw", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function createVapidJwt(audience: string, subject: string, privateKey: CryptoKey): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };

  const enc = new TextEncoder();
  const toBase64Url = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const strToB64Url = (s: string) =>
    btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const headerB64 = strToB64Url(JSON.stringify(header));
  const payloadB64 = strToB64Url(JSON.stringify(payload));
  const unsigned = `${headerB64}.${payloadB64}`;

  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, enc.encode(unsigned));

  const sigArray = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  if (sigArray.length === 64) {
    r = sigArray.slice(0, 32);
    s = sigArray.slice(32, 64);
  } else {
    let offset = 2;
    const rLen = sigArray[offset + 1];
    offset += 2;
    r = sigArray.slice(offset, offset + rLen);
    offset += rLen;
    const sLen = sigArray[offset + 1];
    offset += 2;
    s = sigArray.slice(offset, offset + sLen);
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

async function sendWebPush(
  subscription: { endpoint: string; p256dh: string; auth_key: string },
  payload: string,
  vapidPublicKey: string,
  vapidPrivateKey: CryptoKey
): Promise<boolean> {
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
    console.error("Web push send error:", e);
    return false;
  }
}

// ── Main handler ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPrivateKeyB64 = Deno.env.get("VAPID_PRIVATE_KEY");
    const firebaseSaJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY");
    const vapidPublicKey = "BJZcOwgP8NBFeqVTMiHpUqZWOH2kIy0hqomcRauEZgF2Hd5KdLa6yZ2KaDNddr7xO_BRs3W4BMzH15CahNwvaWk";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Parse request body for mode (default: "evening" = tomorrow reminders)
    let mode = "evening";
    try {
      const body = await req.json();
      if (body?.mode === "morning") mode = "morning";
    } catch { /* no body = evening mode */ }

    // Determine target date
    const targetDate = new Date();
    if (mode === "evening") {
      targetDate.setDate(targetDate.getDate() + 1); // tomorrow
    }
    // morning mode = today
    const targetStr = targetDate.toISOString().split("T")[0];

    const reminderType = mode === "morning" ? "morning_reminder" : "event_reminder";

    // Find events on target date
    const { data: events, error: evErr } = await supabase
      .from("events")
      .select("id, title, date, start_time, end_time, location")
      .eq("date", targetStr)
      .in("status", ["published", "draft"]);

    if (evErr) throw evErr;
    if (!events || events.length === 0) {
      return new Response(JSON.stringify({ message: `No events on ${targetStr}` }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const eventIds = events.map((e: any) => e.id);
    const eventMap: Record<string, any> = {};
    for (const e of events) eventMap[e.id] = e;

    // Get reservations + assistants
    const { data: reservations } = await supabase
      .from("reservations").select("student_id, event_id")
      .in("event_id", eventIds).eq("status", "reserved");

    const { data: assistants } = await supabase
      .from("event_student_assistants").select("student_id, event_id")
      .in("event_id", eventIds);

    const studentEvents: Record<string, string[]> = {};
    const addToMap = (sid: string, eid: string) => {
      if (!studentEvents[sid]) studentEvents[sid] = [];
      if (!studentEvents[sid].includes(eid)) studentEvents[sid].push(eid);
    };
    for (const r of (reservations || [])) addToMap(r.student_id, r.event_id);
    for (const a of (assistants || [])) addToMap(a.student_id, a.event_id);

    const studentIds = Object.keys(studentEvents);
    if (studentIds.length === 0) {
      return new Response(JSON.stringify({ message: "No participants" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Deduplicate notifications
    const { data: existingNotifs } = await supabase
      .from("notifications").select("user_id, related_event_id")
      .in("user_id", studentIds).in("related_event_id", eventIds)
      .eq("type", reminderType);

    const existingSet = new Set(
      (existingNotifs || []).map((n: any) => `${n.user_id}_${n.related_event_id}`)
    );

    const notifTitle = mode === "morning"
      ? "Eveniment astăzi!"
      : "Reminder: Eveniment mâine";

    const notificationsToInsert: any[] = [];
    for (const sid of studentIds) {
      for (const eid of studentEvents[sid]) {
        if (existingSet.has(`${sid}_${eid}`)) continue;
        const ev = eventMap[eid];
        notificationsToInsert.push({
          user_id: sid,
          title: notifTitle,
          body: `${ev.title} • ${ev.start_time?.slice(0, 5)} – ${ev.end_time?.slice(0, 5)}${ev.location ? ` • ${ev.location}` : ""}`,
          type: reminderType,
          related_event_id: eid,
        });
      }
    }

    let insertedCount = 0;
    if (notificationsToInsert.length > 0) {
      const { error: insErr } = await supabase.from("notifications").insert(notificationsToInsert);
      if (insErr) console.error("Insert notifications error:", insErr);
      else insertedCount = notificationsToInsert.length;
    }

    // ── Send Web Push notifications ──
    let webPushCount = 0;
    if (vapidPrivateKeyB64) {
      try {
        const vapidKey = await importPrivateKey(vapidPrivateKeyB64);
        const { data: subs } = await supabase
          .from("push_subscriptions").select("*").in("user_id", studentIds);

        for (const sub of (subs || [])) {
          const evts = studentEvents[sub.user_id] || [];
          if (evts.length === 0) continue;
          const names = evts.map((eid: string) => eventMap[eid]?.title).filter(Boolean);
          const pushPayload = JSON.stringify({
            title: notifTitle,
            body: names.length === 1 ? names[0] : `Ai ${names.length} evenimente ${mode === "morning" ? "astăzi" : "mâine"}`,
            icon: "/favicon.ico",
            data: { url: "/student/tickets" },
          });
          const ok = await sendWebPush(sub, pushPayload, vapidPublicKey, vapidKey);
          if (ok) webPushCount++;
        }
      } catch (e) {
        console.error("Web push error:", e);
      }
    }

    // ── Send FCM push notifications ──
    let fcmCount = 0;
    if (firebaseSaJson) {
      try {
        const sa: ServiceAccount = JSON.parse(firebaseSaJson);
        const accessToken = await getAccessToken(sa);

        const { data: fcmTokens } = await supabase
          .from("fcm_tokens").select("*").in("user_id", studentIds);

        for (const ft of (fcmTokens || [])) {
          const evts = studentEvents[ft.user_id] || [];
          if (evts.length === 0) continue;
          const names = evts.map((eid: string) => eventMap[eid]?.title).filter(Boolean);
          const body = names.length === 1
            ? names[0]
            : `Ai ${names.length} evenimente ${mode === "morning" ? "astăzi" : "mâine"}`;

          const ok = await sendFcmNotification(
            accessToken, sa.project_id, ft.token,
            notifTitle, body, { url: "/student/tickets" }
          );
          if (ok) fcmCount++;
        }
      } catch (e) {
        console.error("FCM error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Created ${insertedCount} notifications, ${webPushCount} web push, ${fcmCount} FCM`,
        events: events.length,
        students: studentIds.length,
        mode,
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
