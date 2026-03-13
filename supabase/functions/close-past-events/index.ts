import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey);

    // Get today's date in UTC
    const today = new Date().toISOString().split("T")[0];

    // Close events that have already passed (date < today) and are still published
    const { data: closedEvents, error } = await supabase
      .from("events")
      .update({ status: "closed" })
      .eq("status", "published")
      .lt("date", today)
      .select("id, title, date");

    if (error) throw error;

    console.log(`Closed ${closedEvents?.length ?? 0} past events`);

    return new Response(
      JSON.stringify({
        success: true,
        closed_count: closedEvents?.length ?? 0,
        closed_events: closedEvents,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error closing past events:", err);
    return new Response(
      JSON.stringify({ error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
