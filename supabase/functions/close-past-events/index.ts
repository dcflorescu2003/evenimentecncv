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

    const closedIds = (closedEvents || []).map((e: any) => e.id);
    let absentTicketsCount = 0;
    let absentPublicCount = 0;

    if (closedIds.length > 0) {
      // Mark remaining reserved tickets as absent
      for (const eventId of closedIds) {
        // Regular tickets: get reservation IDs for this event
        const { data: reservations } = await supabase
          .from("reservations")
          .select("id")
          .eq("event_id", eventId)
          .eq("status", "reserved");

        if (reservations && reservations.length > 0) {
          const resIds = reservations.map((r: any) => r.id);
          const { data: updated } = await supabase
            .from("tickets")
            .update({ status: "absent" })
            .in("reservation_id", resIds)
            .eq("status", "reserved")
            .select("id");
          absentTicketsCount += updated?.length ?? 0;
        }

        // Public tickets: get public reservation IDs for this event
        const { data: pubRes } = await supabase
          .from("public_reservations")
          .select("id")
          .eq("event_id", eventId)
          .eq("status", "reserved");

        if (pubRes && pubRes.length > 0) {
          const pubIds = pubRes.map((r: any) => r.id);
          const { data: updated } = await supabase
            .from("public_tickets")
            .update({ status: "absent" })
            .in("public_reservation_id", pubIds)
            .eq("status", "reserved")
            .select("id");
          absentPublicCount += updated?.length ?? 0;
        }
      }
    }

    console.log(`Closed ${closedIds.length} past events, marked ${absentTicketsCount} tickets + ${absentPublicCount} public tickets as absent`);

    return new Response(
      JSON.stringify({
        success: true,
        closed_count: closedIds.length,
        closed_events: closedEvents,
        absent_tickets: absentTicketsCount,
        absent_public_tickets: absentPublicCount,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err) {
    console.error("Error closing past events:", err);
    return new Response(
      JSON.stringify({ error: (err as Error).message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
