import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;

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
      ["admin", "homeroom_teacher", "teacher", "coordinator_teacher"].includes(r.role)
    );
    if (!allowed) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { day_id, student_id, status } = body || {};
    if (!day_id || !student_id || !status) {
      return new Response(JSON.stringify({ error: "Missing fields" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!["present", "late", "absent"].includes(status)) {
      return new Response(JSON.stringify({ error: "Invalid status" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Resolve day → project
    const { data: day } = await admin
      .from("volunteer_days")
      .select("id, project_id, date")
      .eq("id", day_id)
      .maybeSingle();
    if (!day) {
      return new Response(JSON.stringify({ error: "Day not found" }), {
        status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: project } = await admin
      .from("volunteer_projects")
      .select("id, title")
      .eq("id", day.project_id)
      .maybeSingle();

    // Resolve student → homeroom teacher
    const { data: assignment } = await admin
      .from("student_class_assignments")
      .select("class_id")
      .eq("student_id", student_id)
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();
    if (!assignment?.class_id) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_class" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: klass } = await admin
      .from("classes")
      .select("id, name, homeroom_teacher_id")
      .eq("id", assignment.class_id)
      .maybeSingle();
    if (!klass?.homeroom_teacher_id) {
      return new Response(JSON.stringify({ ok: true, skipped: "no_homeroom" }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: studentProfile } = await admin
      .from("profiles")
      .select("first_name, last_name")
      .eq("id", student_id)
      .maybeSingle();

    const studentName = studentProfile
      ? `${studentProfile.last_name} ${studentProfile.first_name}`
      : "Un elev";
    const projectTitle = project?.title || "Proiect de voluntariat";
    const [y, m, d] = String(day.date).split("-");
    const dateStr = `${d}.${m}.${y}`;

    const statusLabel =
      status === "present" ? "prezent" : status === "late" ? "întârziat" : "absent";
    const title =
      status === "absent"
        ? `Absență la voluntariat – ${klass.name}`
        : `Prezență la voluntariat – ${klass.name}`;
    const msgBody = `${studentName} a fost marcat „${statusLabel}" la „${projectTitle}" (${dateStr}).`;

    // Insert in-app notification (service role bypasses RLS)
    await admin.from("notifications").insert({
      user_id: klass.homeroom_teacher_id,
      title,
      body: msgBody,
      type: "volunteer_attendance",
    });

    // Best-effort push
    try {
      await userClient.functions.invoke("send-push-to-user", {
        body: {
          user_id: klass.homeroom_teacher_id,
          title,
          body: msgBody,
          url: `/prof/clubs`,
        },
      });
    } catch (e) {
      console.warn("Push send failed (non-fatal):", e);
    }

    return new Response(JSON.stringify({ ok: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("notify-volunteer-attendance error:", error);
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
