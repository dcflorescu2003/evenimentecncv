import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

function formatDtBucharest(d: string | Date): string {
  const dt = typeof d === "string" ? new Date(d) : d;
  return dt.toLocaleString("ro-RO", {
    timeZone: "Europe/Bucharest",
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

function validationResponse(error: string, extra?: Record<string, unknown>) {
  return new Response(JSON.stringify({ error, ...extra }), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { event_id, guest_name, guest_email, guest_phone, attendees } = await req.json();

    if (!event_id || !guest_name || !attendees || !Array.isArray(attendees) || attendees.length === 0) {
      return validationResponse("Câmpuri lipsă: event_id, guest_name, attendees[]");
    }

    if (!guest_email || typeof guest_email !== "string" || !guest_email.trim()) {
      return validationResponse("Adresa de email este obligatorie");
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(guest_email.trim())) {
      return validationResponse("Formatul adresei de email este invalid");
    }

    if (attendees.length > 32) {
      return validationResponse("Maximum 32 bilete per rezervare");
    }

    // Rate limiting
    const clientIP = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
    if (clientIP !== "unknown") {
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString();
      const { count: recentCount } = await supabase
        .from("public_reservations")
        .select("id", { count: "exact", head: true })
        .eq("guest_name", guest_name.trim())
        .gte("created_at", oneHourAgo);

      if ((recentCount ?? 0) >= 5) {
        return validationResponse("Prea multe rezervări. Încercați din nou mai târziu.");
      }
    }

    for (const a of attendees) {
      if (!a.name || typeof a.name !== "string" || a.name.trim().length === 0) {
        return validationResponse("Fiecare participant trebuie să aibă un nume");
      }
    }

    // Get event
    const { data: event, error: eventErr } = await supabase
      .from("events")
      .select("*")
      .eq("id", event_id)
      .single();

    if (eventErr || !event) {
      return validationResponse("Evenimentul nu există");
    }

    if (!event.is_public || !event.published || event.status !== "published") {
      return validationResponse("Evenimentul nu este disponibil pentru rezervări publice");
    }

    // Check booking window
    const now = new Date();
    if (event.booking_open_at && now < new Date(event.booking_open_at)) {
      const closeStr = event.booking_close_at ? formatDtBucharest(event.booking_close_at) : "nedefinit";
      return validationResponse(
        `Înscrierile nu sunt deschise încă. Perioada de rezervare: ${formatDtBucharest(event.booking_open_at)} – ${closeStr}`
      );
    }
    if (event.booking_close_at && now > new Date(event.booking_close_at)) {
      return validationResponse("Înscrierile s-au închis");
    }

    // Check capacity
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
      return validationResponse(
        `Nu sunt suficiente locuri. Disponibile: ${remaining}`,
        { available: remaining }
      );
    }

    // Validate phone for 10+ attendees
    if (attendees.length >= 10 && (!guest_phone || typeof guest_phone !== "string" || guest_phone.trim().length < 6)) {
      return validationResponse("Numărul de telefon este obligatoriu pentru rezervări de 10+ locuri");
    }

    // Create reservation
    const { data: reservation, error: resErr } = await supabase
      .from("public_reservations")
      .insert({
        event_id,
        guest_name: guest_name.trim(),
        guest_email: guest_email?.trim() || null,
        guest_phone: guest_phone?.trim() || null,
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

    // Best-effort: send confirmation email with management link
    try {
      const origin = req.headers.get("origin") || "https://evenimentecncv.online";
      const manageUrl = `${origin}/public/tickets/${reservation.reservation_code}`;
      const dateParts = String(event.date).split("-");
      const dateStr = dateParts.length === 3 ? `${dateParts[2]}.${dateParts[1]}.${dateParts[0]}` : event.date;
      const timeStr = `${String(event.start_time).slice(0, 5)} – ${String(event.end_time).slice(0, 5)}`;

      const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
      const emailRes = await fetch(`${supabaseUrl}/functions/v1/send-transactional-email`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${serviceKey}`,
          "apikey": serviceKey,
        },
        body: JSON.stringify({
          templateName: "public-booking-confirmation",
          recipientEmail: reservation.guest_email,
          idempotencyKey: `public-booking-${reservation.id}`,
          templateData: {
            guestName: reservation.guest_name,
            eventTitle: event.title,
            eventDate: dateStr,
            eventTime: timeStr,
            eventLocation: event.location || "",
            ticketCount: tickets.length,
            reservationCode: reservation.reservation_code,
            manageUrl,
          },
        }),
      });
      if (!emailRes.ok) {
        const errText = await emailRes.text();
        console.warn("send-transactional-email failed:", emailRes.status, errText);
      }
    } catch (e) {
      console.warn("Failed to send confirmation email (non-fatal):", e);
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
