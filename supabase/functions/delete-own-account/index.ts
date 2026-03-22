import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // Get the calling user from JWT
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token || token === serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const userId = user.id;

    // Delete related data in order to avoid FK violations
    // 1. attendance_log (via tickets -> reservations)
    await supabase.rpc("has_role", { _user_id: userId, _role: "student" }); // just to verify

    // Delete attendance logs for user's tickets
    const { data: reservationIds } = await supabase
      .from("reservations")
      .select("id")
      .eq("student_id", userId);

    if (reservationIds && reservationIds.length > 0) {
      const resIds = reservationIds.map((r: any) => r.id);
      
      const { data: ticketIds } = await supabase
        .from("tickets")
        .select("id")
        .in("reservation_id", resIds);

      if (ticketIds && ticketIds.length > 0) {
        const tIds = ticketIds.map((t: any) => t.id);
        await supabase.from("attendance_log").delete().in("ticket_id", tIds);
        await supabase.from("tickets").delete().in("id", tIds);
      }

      await supabase.from("reservations").delete().eq("student_id", userId);
    }

    // Delete form submissions
    await supabase.from("form_submissions").delete().eq("student_id", userId);

    // Delete event student assistants
    await supabase.from("event_student_assistants").delete().eq("student_id", userId);

    // Delete student class assignments
    await supabase.from("student_class_assignments").delete().eq("student_id", userId);

    // Delete coordinator assignments (if teacher)
    await supabase.from("coordinator_assignments").delete().eq("teacher_id", userId);

    // Delete notifications
    await supabase.from("notifications").delete().eq("user_id", userId);

    // Delete push subscriptions
    await supabase.from("push_subscriptions").delete().eq("user_id", userId);

    // Delete user roles
    await supabase.from("user_roles").delete().eq("user_id", userId);

    // Delete profile
    await supabase.from("profiles").delete().eq("id", userId);

    // Delete auth user
    const { error: deleteError } = await supabase.auth.admin.deleteUser(userId);
    if (deleteError) {
      console.error("Error deleting auth user:", deleteError);
      return new Response(JSON.stringify({ error: "Eroare la ștergerea contului" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Unexpected error:", err);
    return new Response(JSON.stringify({ error: "Eroare internă" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
