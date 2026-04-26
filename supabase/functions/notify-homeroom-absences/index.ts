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

async function sendFcm(
  accessToken: string, projectId: string, deviceToken: string,
  title: string, body: string, data?: Record<string, string>
): Promise<{ ok: boolean; invalid: boolean }> {
  try {
    const resp = await fetch(
      `https://fcm.googleapis.com/v1/projects/${projectId}/messages:send`,
      {
        method: "POST",
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title, body },
            data: data || {},
            android: {
              priority: "high",
              notification: {
                channel_id: "default", sound: "default",
                default_sound: true, default_vibrate_timings: true,
                notification_priority: "PRIORITY_HIGH",
              },
            },
          },
        }),
      }
    );
    if (!resp.ok) {
      const err = await resp.text();
      const invalid = resp.status === 404 || resp.status === 410 ||
        (resp.status === 400 && /UNREGISTERED|INVALID_ARGUMENT|registration-token-not-registered/i.test(err));
      return { ok: false, invalid };
    }
    return { ok: true, invalid: false };
  } catch {
    return { ok: false, invalid: false };
  }
}

// ── Web Push helpers ────────────────────────────────────────────────────

function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array([...atob(base64)].map((c) => c.charCodeAt(0)));
}

async function importVapidKey(b64: string) {
  const raw = urlBase64ToUint8Array(b64);
  return await crypto.subtle.importKey(
    "raw",
    raw.buffer.slice(raw.byteOffset, raw.byteOffset + raw.byteLength) as ArrayBuffer,
    { name: "ECDSA", namedCurve: "P-256" },
    false, ["sign"],
  );
}

async function createVapidJwt(audience: string, subject: string, privateKey: CryptoKey): Promise<string> {
  const header = { typ: "JWT", alg: "ES256" };
  const now = Math.floor(Date.now() / 1000);
  const payload = { aud: audience, exp: now + 86400, sub: subject };
  const enc = new TextEncoder();
  const toB64Url = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const strToB64Url = (s: string) => btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const headerB64 = strToB64Url(JSON.stringify(header));
  const payloadB64 = strToB64Url(JSON.stringify(payload));
  const unsigned = `${headerB64}.${payloadB64}`;
  const sig = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, enc.encode(unsigned));
  const sigArr = new Uint8Array(sig);
  let r: Uint8Array, s: Uint8Array;
  if (sigArr.length === 64) { r = sigArr.slice(0, 32); s = sigArr.slice(32, 64); }
  else {
    let o = 2; const rLen = sigArr[o + 1]; o += 2;
    r = sigArr.slice(o, o + rLen); o += rLen;
    const sLen = sigArr[o + 1]; o += 2;
    s = sigArr.slice(o, o + sLen);
    if (r.length > 32) r = r.slice(r.length - 32);
    if (s.length > 32) s = s.slice(s.length - 32);
    if (r.length < 32) { const p = new Uint8Array(32); p.set(r, 32 - r.length); r = p; }
    if (s.length < 32) { const p = new Uint8Array(32); p.set(s, 32 - s.length); s = p; }
  }
  const raw = new Uint8Array(64); raw.set(r, 0); raw.set(s, 32);
  return `${unsigned}.${toB64Url(raw.buffer)}`;
}

async function sendWebPush(
  sub: { endpoint: string; p256dh: string; auth_key: string },
  payload: string, vapidPub: string, vapidKey: CryptoKey
): Promise<{ ok: boolean; invalid: boolean }> {
  try {
    const url = new URL(sub.endpoint);
    const audience = `${url.protocol}//${url.host}`;
    const jwt = await createVapidJwt(audience, "mailto:noreply@school.local", vapidKey);
    const resp = await fetch(sub.endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/octet-stream", "TTL": "86400",
        "Authorization": `vapid t=${jwt}, k=${vapidPub}`,
      },
      body: new TextEncoder().encode(payload),
    });
    return { ok: resp.ok || resp.status === 201, invalid: resp.status === 404 || resp.status === 410 };
  } catch {
    return { ok: false, invalid: false };
  }
}

// ── Main handler ────────────────────────────────────────────────────────

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const vapidPrivateB64 = Deno.env.get("VAPID_PRIVATE_KEY");
    const firebaseSaJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY");
    const vapidPublic = "BJZcOwgP8NBFeqVTMiHpUqZWOH2kIy0hqomcRauEZgF2Hd5KdLa6yZ2KaDNddr7xO_BRs3W4BMzH15CahNwvaWk";

    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Today's date in Europe/Bucharest
    const now = new Date();
    const bucharestStr = new Intl.DateTimeFormat("en-CA", {
      timeZone: "Europe/Bucharest", year: "numeric", month: "2-digit", day: "2-digit",
    }).format(now);
    const localTimeStr = new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/Bucharest", hour: "2-digit", minute: "2-digit", hour12: false,
    }).format(now);

    // Find events that took place today and have already ended
    const { data: events, error: evErr } = await supabase
      .from("events")
      .select("id, title, date, end_time")
      .eq("date", bucharestStr)
      .in("status", ["published", "closed", "draft"]);
    if (evErr) throw evErr;

    const endedEvents = (events || []).filter((e: any) => {
      const endTime = (e.end_time || "00:00").slice(0, 5);
      return endTime <= localTimeStr;
    });

    if (endedEvents.length === 0) {
      return new Response(JSON.stringify({ message: `No ended events today (${bucharestStr} ${localTimeStr})` }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const eventIds = endedEvents.map((e: any) => e.id);
    const eventMap: Record<string, any> = {};
    for (const e of endedEvents) eventMap[e.id] = e;

    // Get reservations for these events
    const { data: reservations } = await supabase
      .from("reservations")
      .select("id, student_id, event_id")
      .in("event_id", eventIds)
      .eq("status", "reserved");

    if (!reservations || reservations.length === 0) {
      return new Response(JSON.stringify({ message: "No reservations" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    const reservationIds = reservations.map((r: any) => r.id);
    const resById: Record<string, any> = {};
    for (const r of reservations) resById[r.id] = r;

    // Get tickets — absent or still reserved (= didn't attend)
    const { data: tickets } = await supabase
      .from("tickets")
      .select("reservation_id, status")
      .in("reservation_id", reservationIds);

    const absentByEvent: Record<string, Set<string>> = {}; // event_id -> set of student_id
    for (const t of (tickets || [])) {
      if (t.status === "absent" || t.status === "reserved") {
        const r = resById[t.reservation_id];
        if (!r) continue;
        if (!absentByEvent[r.event_id]) absentByEvent[r.event_id] = new Set();
        absentByEvent[r.event_id].add(r.student_id);
      }
    }

    // Also include reservations without ticket rows (treat as absent)
    const ticketResIds = new Set((tickets || []).map((t: any) => t.reservation_id));
    for (const r of reservations) {
      if (!ticketResIds.has(r.id)) {
        if (!absentByEvent[r.event_id]) absentByEvent[r.event_id] = new Set();
        absentByEvent[r.event_id].add(r.student_id);
      }
    }

    // Collect all absent student ids
    const allAbsentStudentIds = new Set<string>();
    for (const set of Object.values(absentByEvent)) {
      for (const sid of set) allAbsentStudentIds.add(sid);
    }
    if (allAbsentStudentIds.size === 0) {
      return new Response(JSON.stringify({ message: "No absent students" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Map student -> homeroom_teacher_id via classes (most recent assignment)
    const { data: assignments } = await supabase
      .from("student_class_assignments")
      .select("student_id, class_id, created_at")
      .in("student_id", Array.from(allAbsentStudentIds))
      .order("created_at", { ascending: false });

    const studentClass: Record<string, string> = {};
    for (const a of (assignments || [])) {
      if (!studentClass[a.student_id]) studentClass[a.student_id] = a.class_id;
    }

    const classIds = Array.from(new Set(Object.values(studentClass)));
    const { data: classes } = await supabase
      .from("classes")
      .select("id, display_name, homeroom_teacher_id")
      .in("id", classIds);

    const classMap: Record<string, any> = {};
    for (const c of (classes || [])) classMap[c.id] = c;

    // Build: teacher_id -> event_id -> count of absent students from teacher's class
    const teacherEventCount: Record<string, Record<string, number>> = {};
    for (const [eventId, studentSet] of Object.entries(absentByEvent)) {
      for (const sid of studentSet) {
        const cid = studentClass[sid];
        if (!cid) continue;
        const cls = classMap[cid];
        if (!cls?.homeroom_teacher_id) continue;
        const tid = cls.homeroom_teacher_id;
        if (!teacherEventCount[tid]) teacherEventCount[tid] = {};
        teacherEventCount[tid][eventId] = (teacherEventCount[tid][eventId] || 0) + 1;
      }
    }

    const teacherIds = Object.keys(teacherEventCount);
    if (teacherIds.length === 0) {
      return new Response(JSON.stringify({ message: "No homeroom teachers to notify" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Deduplicate against existing notifications
    const { data: existing } = await supabase
      .from("notifications")
      .select("user_id, related_event_id")
      .in("user_id", teacherIds)
      .in("related_event_id", eventIds)
      .eq("type", "homeroom_absence_alert");
    const existingSet = new Set((existing || []).map((n: any) => `${n.user_id}_${n.related_event_id}`));

    const toInsert: any[] = [];
    const teacherEvents: Record<string, string[]> = {}; // for push
    for (const tid of teacherIds) {
      for (const [eid, cnt] of Object.entries(teacherEventCount[tid])) {
        if (existingSet.has(`${tid}_${eid}`)) continue;
        const ev = eventMap[eid];
        toInsert.push({
          user_id: tid,
          title: "Eveniment încheiat — verifică prezența",
          body: `Evenimentul „${ev.title}” s-a încheiat. Ai ${cnt} elev${cnt === 1 ? "" : "i"} din clasă marca${cnt === 1 ? "t" : "ți"} absen${cnt === 1 ? "t" : "ți"}. Verifică lista de prezență.`,
          type: "homeroom_absence_alert",
          related_event_id: eid,
        });
        if (!teacherEvents[tid]) teacherEvents[tid] = [];
        teacherEvents[tid].push(eid);
      }
    }

    let inserted = 0;
    if (toInsert.length > 0) {
      const { error: insErr } = await supabase.from("notifications").insert(toInsert);
      if (insErr) console.error("Insert error:", insErr);
      else inserted = toInsert.length;
    }

    // ── Push notifications ──
    let webPushCount = 0, fcmCount = 0;
    const pushTitle = "Eveniment încheiat — verifică prezența";

    if (vapidPrivateB64 && Object.keys(teacherEvents).length > 0) {
      try {
        const vapidKey = await importVapidKey(vapidPrivateB64);
        const { data: subs } = await supabase
          .from("push_subscriptions").select("*").in("user_id", Object.keys(teacherEvents));
        const invalidIds: string[] = [];
        for (const sub of (subs || [])) {
          const eids = teacherEvents[sub.user_id] || [];
          if (eids.length === 0) continue;
          const body = eids.length === 1
            ? `Evenimentul „${eventMap[eids[0]]?.title}” s-a încheiat. Verifică lista de prezență.`
            : `${eids.length} evenimente s-au încheiat. Verifică listele de prezență.`;
          const payload = JSON.stringify({
            title: pushTitle, body, icon: "/favicon.ico",
            data: { url: "/teacher/reports" },
          });
          const r = await sendWebPush(sub, payload, vapidPublic, vapidKey);
          if (r.ok) webPushCount++;
          if (r.invalid) invalidIds.push(sub.id);
        }
        if (invalidIds.length > 0) {
          await supabase.from("push_subscriptions").delete().in("id", invalidIds);
        }
      } catch (e) {
        console.error("Web push error:", e);
      }
    }

    if (firebaseSaJson && Object.keys(teacherEvents).length > 0) {
      try {
        const sa: ServiceAccount = JSON.parse(firebaseSaJson);
        const accessToken = await getAccessToken(sa);
        const { data: tokens } = await supabase
          .from("fcm_tokens").select("*").in("user_id", Object.keys(teacherEvents));
        const invalidIds: string[] = [];
        for (const ft of (tokens || [])) {
          const eids = teacherEvents[ft.user_id] || [];
          if (eids.length === 0) continue;
          const body = eids.length === 1
            ? `Evenimentul „${eventMap[eids[0]]?.title}” s-a încheiat. Verifică lista de prezență.`
            : `${eids.length} evenimente s-au încheiat. Verifică listele de prezență.`;
          const r = await sendFcm(accessToken, sa.project_id, ft.token, pushTitle, body, { url: "/teacher/reports" });
          if (r.ok) fcmCount++;
          if (r.invalid) invalidIds.push(ft.id);
        }
        if (invalidIds.length > 0) {
          await supabase.from("fcm_tokens").delete().in("id", invalidIds);
        }
      } catch (e) {
        console.error("FCM error:", e);
      }
    }

    return new Response(
      JSON.stringify({
        message: `Notified ${teacherIds.length} homeroom teachers about absences`,
        endedEvents: endedEvents.length,
        inserted, webPushCount, fcmCount,
        bucharestDate: bucharestStr, bucharestTime: localTimeStr,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
