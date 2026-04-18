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
        headers: { Authorization: `Bearer ${accessToken}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          message: {
            token: deviceToken,
            notification: { title, body },
            data: data || {},
            android: { priority: "high", notification: { click_action: "FLUTTER_NOTIFICATION_CLICK" } },
          },
        }),
      }
    );
    if (!resp.ok) {
      console.error("FCM send error:", resp.status, await resp.text());
      return false;
    }
    return true;
  } catch (e) {
    console.error("FCM send exception:", e);
    return false;
  }
}

// ── Web Push helpers ────────────────────────────────────────────────────
function urlBase64ToUint8Array(b64: string): Uint8Array {
  const padding = "=".repeat((4 - (b64.length % 4)) % 4);
  const base64 = (b64 + padding).replace(/-/g, "+").replace(/_/g, "/");
  return new Uint8Array([...atob(base64)].map((c) => c.charCodeAt(0)));
}

async function importPrivateKey(b64url: string) {
  const raw = urlBase64ToUint8Array(b64url);
  return await crypto.subtle.importKey("raw", raw, { name: "ECDSA", namedCurve: "P-256" }, false, ["sign"]);
}

async function createVapidJwt(audience: string, subject: string, privateKey: CryptoKey): Promise<string> {
  const now = Math.floor(Date.now() / 1000);
  const enc = new TextEncoder();
  const toB64Url = (buf: ArrayBuffer) =>
    btoa(String.fromCharCode(...new Uint8Array(buf)))
      .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  const strToB64Url = (s: string) =>
    btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");

  const headerB64 = strToB64Url(JSON.stringify({ typ: "JWT", alg: "ES256" }));
  const payloadB64 = strToB64Url(JSON.stringify({ aud: audience, exp: now + 86400, sub: subject }));
  const unsigned = `${headerB64}.${payloadB64}`;
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, privateKey, enc.encode(unsigned));

  const sigArray = new Uint8Array(signature);
  let r: Uint8Array, s: Uint8Array;
  if (sigArray.length === 64) {
    r = sigArray.slice(0, 32); s = sigArray.slice(32, 64);
  } else {
    let offset = 2;
    const rLen = sigArray[offset + 1]; offset += 2;
    r = sigArray.slice(offset, offset + rLen); offset += rLen;
    const sLen = sigArray[offset + 1]; offset += 2;
    s = sigArray.slice(offset, offset + sLen);
    if (r.length > 32) r = r.slice(r.length - 32);
    if (s.length > 32) s = s.slice(s.length - 32);
    if (r.length < 32) { const p = new Uint8Array(32); p.set(r, 32 - r.length); r = p; }
    if (s.length < 32) { const p = new Uint8Array(32); p.set(s, 32 - s.length); s = p; }
  }
  const rawSig = new Uint8Array(64); rawSig.set(r, 0); rawSig.set(s, 32);
  return `${unsigned}.${toB64Url(rawSig.buffer)}`;
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
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const vapidPrivateKeyB64 = Deno.env.get("VAPID_PRIVATE_KEY");
    const firebaseSaJson = Deno.env.get("FIREBASE_SERVICE_ACCOUNT_KEY");
    const vapidPublicKey = "BJZcOwgP8NBFeqVTMiHpUqZWOH2kIy0hqomcRauEZgF2Hd5KdLa6yZ2KaDNddr7xO_BRs3W4BMzH15CahNwvaWk";

    // Authenticate caller — must be admin or homeroom_teacher or teacher
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user }, error: userErr } = await userClient.auth.getUser();
    if (userErr || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    const allowed = (roles || []).some((r: any) =>
      ["admin", "homeroom_teacher", "teacher"].includes(r.role)
    );
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { user_id, title, body: msgBody, url } = body || {};
    if (!user_id || !title || !msgBody) {
      return new Response(JSON.stringify({ error: "Missing required fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const targetUrl = url || "/student/tickets";

    // Web Push
    let webPushCount = 0;
    if (vapidPrivateKeyB64) {
      try {
        const vapidKey = await importPrivateKey(vapidPrivateKeyB64);
        const { data: subs } = await admin
          .from("push_subscriptions").select("*").eq("user_id", user_id);
        for (const sub of (subs || [])) {
          const payload = JSON.stringify({
            title, body: msgBody, icon: "/favicon.ico", data: { url: targetUrl },
          });
          if (await sendWebPush(sub, payload, vapidPublicKey, vapidKey)) webPushCount++;
        }
      } catch (e) {
        console.error("Web push block error:", e);
      }
    }

    // FCM
    let fcmCount = 0;
    if (firebaseSaJson) {
      try {
        const sa: ServiceAccount = JSON.parse(firebaseSaJson);
        const accessToken = await getAccessToken(sa);
        const { data: tokens } = await admin
          .from("fcm_tokens").select("*").eq("user_id", user_id);
        for (const ft of (tokens || [])) {
          if (await sendFcmNotification(
            accessToken, sa.project_id, ft.token, title, msgBody, { url: targetUrl }
          )) fcmCount++;
        }
      } catch (e) {
        console.error("FCM block error:", e);
      }
    }

    return new Response(
      JSON.stringify({ ok: true, webPushCount, fcmCount }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error) {
    console.error("Error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
