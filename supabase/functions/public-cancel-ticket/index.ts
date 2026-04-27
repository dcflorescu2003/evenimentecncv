import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { reservation_code, ticket_id } = await req.json();

    if (!reservation_code || typeof reservation_code !== "string") {
      return new Response(JSON.stringify({ error: "Cod rezervare lipsă" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: reservation, error: resErr } = await supabase
      .from("public_reservations")
      .select("id, status, event_id")
      .eq("reservation_code", reservation_code)
      .maybeSingle();

    if (resErr || !reservation) {
      return new Response(JSON.stringify({ error: "Rezervare negăsită" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check event date — refuse cancellation for past events
    const { data: event } = await supabase
      .from("events")
      .select("date, end_time, start_time")
      .eq("id", reservation.event_id)
      .maybeSingle();

    if (event) {
      const eventEnd = new Date(`${event.date}T${event.end_time || event.start_time}`);
      if (eventEnd < new Date()) {
        return new Response(JSON.stringify({ error: "Evenimentul a trecut deja, biletele nu mai pot fi anulate." }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    if (ticket_id) {
      // Cancel a single ticket
      const { data: ticket, error: tErr } = await supabase
        .from("public_tickets")
        .select("id, public_reservation_id, status")
        .eq("id", ticket_id)
        .eq("public_reservation_id", reservation.id)
        .maybeSingle();

      if (tErr || !ticket) {
        return new Response(JSON.stringify({ error: "Bilet negăsit" }), {
          status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      if (ticket.status === "cancelled") {
        return new Response(JSON.stringify({ ok: true, already_cancelled: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      const { error: updErr } = await supabase
        .from("public_tickets")
        .update({ status: "cancelled" })
        .eq("id", ticket_id);

      if (updErr) throw updErr;

      // If all tickets are cancelled, mark the reservation as cancelled too
      const { data: remaining } = await supabase
        .from("public_tickets")
        .select("id")
        .eq("public_reservation_id", reservation.id)
        .neq("status", "cancelled");

      if (!remaining || remaining.length === 0) {
        await supabase
          .from("public_reservations")
          .update({ status: "cancelled" })
          .eq("id", reservation.id);
      }
    } else {
      // Cancel all tickets + reservation
      await supabase
        .from("public_tickets")
        .update({ status: "cancelled" })
        .eq("public_reservation_id", reservation.id);

      await supabase
        .from("public_reservations")
        .update({ status: "cancelled" })
        .eq("id", reservation.id);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
