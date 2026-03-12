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

    const { event_id, guest_name, guest_email, attendees } = await req.json();

    if (!event_id || !guest_name || !attendees || !Array.isArray(attendees) || attendees.length === 0) {
      return new Response(JSON.stringify({ error: "Câmpuri lipsă: event_id, guest_name, attendees[]" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (attendees.length > 32) {
      return new Response(JSON.stringify({ error: "Maximum 32 bilete per rezervare" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    for (const a of attendees) {
      if (!a.name || typeof a.name !== "string" || a.name.trim().length === 0) {
        return new Response(JSON.stringify({ error: "Fiecare participant trebuie să aibă un nume" }), {
          status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // Get event
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eventErr || !event) {
      return new Response(JSON.stringify({ error: "Evenimentul nu există" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!event.is_public || !event.published || event.status !== "published") {
      return new Response(JSON.stringify({ error: "Evenimentul nu este disponibil pentru rezervări publice" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check booking window
    const now = new Date();
    if (event.booking_open_at && now < new Date(event.booking_open_at)) {
      return new Response(JSON.stringify({ error: "Înscrierile nu sunt deschise încă" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (event.booking_close_at && now > new Date(event.booking_close_at)) {
      return new Response(JSON.stringify({ error: "Înscrierile s-au închis" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Check capacity (normal + public reservations)
    const { count: normalCount } = await supabase
      .from("reservations")
      .select("id", { count: "exact", head: true })
      .eq("event_id", event_id)
      .eq("status", "reserved");

    const { data: publicTicketCount } = await supabase
      .from("public_tickets")
      .select("id, public_reservations!inner(event_id, status)")
      .eq("public_reservations.event_id", event_id)
      .eq("public_reservations.status", "reserved")
      .neq("status", "cancelled");

    const currentOccupied = (normalCount ?? 0) + (publicTicketCount?.length ?? 0);
    const remaining = event.max_capacity - currentOccupied;

    if (attendees.length > remaining) {
      return new Response(JSON.stringify({ 
        error: `Nu sunt suficiente locuri. Disponibile: ${remaining}`,
        available: remaining,
      }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create reservation
    const { data: reservation, error: resErr } = await supabase
      .from("public_reservations")
      .insert({
        event_id,
        guest_name: guest_name.trim(),
        guest_email: guest_email?.trim() || null,
      })
      .select()
      .single();

    if (resErr) {
      return new Response(JSON.stringify({ error: resErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Create tickets
    const ticketInserts = attendees.map((a: { name: string }) => ({
      public_reservation_id: reservation.id,
      attendee_name: a.name.trim(),
    }));

    const { data: tickets, error: tickErr } = await supabase
      .from("public_tickets")
      .insert(ticketInserts)
      .select();

    if (tickErr) {
      return new Response(JSON.stringify({ error: tickErr.message }), {
        status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({
      reservation_code: reservation.reservation_code,
      reservation_id: reservation.id,
      tickets: tickets.map((t: any) => ({
        id: t.id,
        attendee_name: t.attendee_name,
        qr_code_data: t.qr_code_data,
      })),
      event: {
        title: event.title,
        date: event.date,
        start_time: event.start_time,
        end_time: event.end_time,
        location: event.location,
      },
    }), {
      status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err) {
    return new Response(JSON.stringify({ error: (err as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
