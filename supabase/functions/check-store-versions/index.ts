import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

const BUNDLE_ID = "com.evenimentecncv.app";
const PLAY_STORE_URL = `https://play.google.com/store/apps/details?id=${BUNDLE_ID}&hl=en&gl=US`;
const ITUNES_LOOKUP_URL = `https://itunes.apple.com/lookup?bundleId=${BUNDLE_ID}&country=ro`;

function isValidVersion(v: unknown): v is string {
  return typeof v === "string" && /^\d+\.\d+(\.\d+)?$/.test(v);
}

async function fetchIosVersion(): Promise<string | null> {
  try {
    const res = await fetch(ITUNES_LOOKUP_URL);
    if (!res.ok) return null;
    const data = await res.json();
    const version = data?.results?.[0]?.version;
    return isValidVersion(version) ? version : null;
  } catch {
    return null;
  }
}

async function fetchAndroidVersion(): Promise<string | null> {
  try {
    const res = await fetch(PLAY_STORE_URL, {
      headers: { "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36" },
    });
    if (!res.ok) return null;
    const html = await res.text();
    // Play Store embeds the version in several script payloads; try known patterns.
    const patterns = [
      /\["([0-9]+(?:\.[0-9]+){1,2})"\],\[\[null,null,null,\[7/,
      /"softwareVersion"\s*:\s*"([0-9]+(?:\.[0-9]+){1,2})"/,
      /Current Version[^0-9]{0,200}([0-9]+\.[0-9]+(?:\.[0-9]+)?)/,
      /\[\[\["([0-9]+(?:\.[0-9]+){1,2})"\]\]/,
    ];
    for (const re of patterns) {
      const m = html.match(re);
      if (m && isValidVersion(m[1])) return m[1];
    }
    return null;
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    const [iosVersion, androidVersion] = await Promise.all([
      fetchIosVersion(),
      fetchAndroidVersion(),
    ]);

    const results: Record<string, { latest_version: string | null; updated: boolean }> = {};

    if (iosVersion) {
      const { error } = await supabase
        .from("app_versions")
        .update({
          latest_version: iosVersion,
          store_url: "https://apps.apple.com/ro/app/evenimente-cncv/id6763886210",
        })
        .eq("platform", "ios");
      results.ios = { latest_version: iosVersion, updated: !error };
    } else {
      results.ios = { latest_version: null, updated: false };
    }

    if (androidVersion) {
      const { error } = await supabase
        .from("app_versions")
        .update({
          latest_version: androidVersion,
          store_url: `https://play.google.com/store/apps/details?id=${BUNDLE_ID}`,
        })
        .eq("platform", "android");
      results.android = { latest_version: androidVersion, updated: !error };
    } else {
      results.android = { latest_version: null, updated: false };
    }

    return new Response(JSON.stringify({ ok: true, results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 200,
    });
  } catch (err) {
    return new Response(JSON.stringify({ ok: false, error: String(err) }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
      status: 500,
    });
  }
});
