import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing authorization" }, 401);

    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await userClient.auth.getUser();
    if (!user) return json({ error: "Unauthorized" }, 401);

    const admin = createClient(supabaseUrl, serviceRoleKey);
    const { data: roles } = await admin.from("user_roles").select("role").eq("user_id", user.id);
    if (!(roles || []).some((r: { role: string }) => r.role === "admin")) {
      return json({ error: "Forbidden" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const url = typeof body?.url === "string" ? body.url : null;
    if (!url || !/^https:\/\//.test(url)) return json({ error: "URL invalid" }, 400);

    const res = await fetch(url);
    if (!res.ok) return json({ error: `Descărcare eșuată (${res.status})` }, 400);
    const rows = await res.json();
    if (!Array.isArray(rows)) return json({ error: "Format invalid" }, 400);

    let inserted = 0;
    for (let i = 0; i < rows.length; i += 400) {
      const chunk = rows.slice(i, i + 400).map((r: Record<string, unknown>) => ({
        subject: String(r.subject ?? ""),
        name: String(r.name ?? ""),
        media_type: r.media_type ?? null,
        size_label: r.size_label ?? null,
        preview_url: r.preview_url ?? null,
        track_url: r.track_url ?? null,
        track_id: r.track_id ?? null,
      }));
      const { error } = await admin
        .from("vr_materials")
        .upsert(chunk, { onConflict: "track_id" });
      if (error) return json({ error: error.message, inserted }, 500);
      inserted += chunk.length;
    }

    return json({ ok: true, inserted });
  } catch (error) {
    console.error("import-vr-materials error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
