import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SOURCE_URL = "https://flashcantemir.onrender.com/api/menu";
const CACHE_TTL_MS = 10 * 60 * 1000;

interface MenuItem {
  id: string;
  name: string;
  dish_type: string;
  date: string;
  image_url?: string;
  created_at?: string;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Try cache first
    const { data: cached } = await supabase
      .from("cantina_menu_cache")
      .select("payload, fetched_at")
      .eq("id", 1)
      .maybeSingle();

    const now = Date.now();
    if (cached && now - new Date(cached.fetched_at).getTime() < CACHE_TTL_MS) {
      return new Response(
        JSON.stringify({ items: cached.payload, cached: true, fetched_at: cached.fetched_at }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Fetch fresh
    let items: MenuItem[] = [];
    try {
      const res = await fetch(SOURCE_URL, { signal: AbortSignal.timeout(8000) });
      if (res.ok) {
        items = (await res.json()) as MenuItem[];
      } else if (cached) {
        // upstream failed but we have stale cache
        return new Response(
          JSON.stringify({ items: cached.payload, cached: true, stale: true, fetched_at: cached.fetched_at }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      } else {
        throw new Error(`Upstream HTTP ${res.status}`);
      }
    } catch (e) {
      if (cached) {
        return new Response(
          JSON.stringify({ items: cached.payload, cached: true, stale: true, fetched_at: cached.fetched_at }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } },
        );
      }
      throw e;
    }

    // Sort by date asc, dish_type asc (fel1 before fel2)
    items.sort((a, b) => {
      if (a.date !== b.date) return a.date < b.date ? -1 : 1;
      return (a.dish_type ?? "").localeCompare(b.dish_type ?? "");
    });

    await supabase
      .from("cantina_menu_cache")
      .upsert({ id: 1, payload: items, fetched_at: new Date().toISOString() });

    return new Response(
      JSON.stringify({ items, cached: false, fetched_at: new Date().toISOString() }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err) {
    return new Response(
      JSON.stringify({ error: err instanceof Error ? err.message : "Eroare necunoscută" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
