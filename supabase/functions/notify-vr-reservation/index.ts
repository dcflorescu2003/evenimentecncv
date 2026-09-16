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

    const body = await req.json().catch(() => ({}));
    const reservationId = typeof body?.reservation_id === "string" ? body.reservation_id : null;
    const action = ["created", "updated", "cancelled"].includes(body?.action)
      ? (body.action as "created" | "updated" | "cancelled")
      : "created";
    if (!reservationId) return json({ error: "reservation_id lipsă" }, 400);

    const admin = createClient(supabaseUrl, serviceRoleKey);

    const { data: res } = await admin
      .from("vr_reservations")
      .select("id, date, start_time, class_id, room_id, teacher_id")
      .eq("id", reservationId)
      .maybeSingle();
    if (!res) return json({ error: "Rezervarea nu există" }, 404);

    const [{ data: klass }, { data: room }, { data: teacher }, { data: mats }, { data: vols }] =
      await Promise.all([
        admin.from("classes").select("display_name").eq("id", res.class_id).maybeSingle(),
        admin.from("vr_rooms").select("name").eq("id", res.room_id).maybeSingle(),
        admin.from("profiles").select("first_name, last_name").eq("id", res.teacher_id).maybeSingle(),
        admin
          .from("vr_reservation_materials")
          .select("vr_materials(name)")
          .eq("reservation_id", res.id),
        admin.from("vr_volunteers").select("student_id").eq("class_id", res.class_id),
      ]);

    const volunteers = (vols || []).map((v: { student_id: string }) => v.student_id);
    if (volunteers.length === 0) return json({ ok: true, notified: 0 });

    const [y, m, d] = String(res.date).split("-");
    const dateStr = `${d}.${m}.${y}`;
    const timeStr = String(res.start_time).slice(0, 5);
    const materialNames = (mats || [])
      .map((x: { vr_materials: { name: string } | null }) => x.vr_materials?.name)
      .filter(Boolean);
    const teacherName = teacher ? `${teacher.last_name} ${teacher.first_name}` : "Un profesor";

    const title =
      action === "cancelled"
        ? "Rezervare VR anulată"
        : action === "updated"
        ? "Rezervare VR modificată"
        : "Rezervare VR nouă";

    const parts = [
      `${teacherName} – ${klass?.display_name ?? "clasa ta"}`,
      `${dateStr}, ora ${timeStr}, ${room?.name ?? ""}`.trim(),
    ];
    if (action !== "cancelled" && materialNames.length) {
      parts.push(
        `Materiale: ${materialNames.slice(0, 4).join(", ")}${
          materialNames.length > 4 ? ` +${materialNames.length - 4}` : ""
        }`,
      );
    }
    const msgBody = parts.join(" · ");

    await admin.from("notifications").insert(
      volunteers.map((uid) => ({
        user_id: uid,
        title,
        body: msgBody,
        type: "vr_reservation",
      })),
    );

    for (const uid of volunteers) {
      try {
        await userClient.functions.invoke("send-push-to-user", {
          body: { user_id: uid, title, body: msgBody, url: "/smartlab" },
        });
      } catch (e) {
        console.warn("Push failed (non-fatal)", e);
      }
    }

    return json({ ok: true, notified: volunteers.length });
  } catch (error) {
    console.error("notify-vr-reservation error:", error);
    return json({ error: (error as Error).message }, 500);
  }
});
