import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const headers = { ...corsHeaders, "Content-Type": "application/json" };
const allowHeaders = {
  ...headers,
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-api-key",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: allowHeaders });
}

/** Comparație în timp constant, ca să nu se poată ghici cheia. */
function safeEqual(a: string, b: string) {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: allowHeaders });
  }

  const expected = Deno.env.get("CANTEEN_API_KEY");
  if (!expected) {
    return json({ error: "API neconfigurat." }, 500);
  }

  const provided =
    req.headers.get("x-api-key") ??
    (req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "");
  if (!provided || !safeEqual(provided, expected)) {
    return json({ error: "Cheie de acces invalidă." }, 401);
  }

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const url = new URL(req.url);
  const action = url.pathname.split("/").filter(Boolean).pop() ?? "";

  try {
    if (action === "students") {
      const limit = Math.min(Math.max(Number(url.searchParams.get("limit") ?? 500), 1), 1000);
      const offset = Math.max(Number(url.searchParams.get("offset") ?? 0), 0);

      const { data: roles, error: rolesError } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "student")
        .range(offset, offset + limit - 1);
      if (rolesError) throw rolesError;

      const ids = (roles ?? []).map((r) => r.user_id);
      if (ids.length === 0) {
        return json({ students: [], limit, offset, count: 0 });
      }

      const { data: profiles, error: profilesError } = await supabase
        .from("profiles")
        .select("id, first_name, last_name, display_name, student_identifier, is_active")
        .in("id", ids);
      if (profilesError) throw profilesError;

      const { data: assignments, error: assignError } = await supabase
        .from("student_class_assignments")
        .select("student_id, academic_year, classes(display_name)")
        .in("student_id", ids)
        .order("academic_year", { ascending: false });
      if (assignError) throw assignError;

      const classByStudent = new Map<string, string>();
      for (const a of assignments ?? []) {
        const sid = (a as any).student_id as string;
        if (!classByStudent.has(sid)) {
          classByStudent.set(sid, (a as any).classes?.display_name ?? null);
        }
      }

      const students = (profiles ?? [])
        .map((p) => ({
          id: p.id,
          first_name: p.first_name,
          last_name: p.last_name,
          display_name: p.display_name,
          student_identifier: p.student_identifier,
          class: classByStudent.get(p.id) ?? null,
          is_active: p.is_active,
        }))
        .sort((a, b) => (a.last_name ?? "").localeCompare(b.last_name ?? "", "ro"));

      await supabase.from("canteen_api_log").insert({ action: "students", ok: true });

      return json({ students, limit, offset, count: students.length });
    }

    if (action === "resolve-badge") {
      let body: { qr?: unknown } = {};
      try {
        body = await req.json();
      } catch {
        return json({ ok: false, message: "Corp JSON invalid." }, 400);
      }
      const qr = typeof body.qr === "string" ? body.qr.trim() : "";
      if (!qr || qr.length > 200) {
        return json({ ok: false, message: "Câmpul „qr” este obligatoriu." }, 400);
      }

      const { data, error } = await supabase.rpc("resolve_student_badge_public", { _qr: qr });
      if (error) throw error;

      const res = (data ?? {}) as { ok?: boolean; student_id?: string; message?: string };
      await supabase.from("canteen_api_log").insert({
        action: "resolve-badge",
        student_id: res.student_id ?? null,
        ok: !!res.ok,
        message: res.message ?? null,
      });

      return json(res, res.ok ? 200 : 404);
    }

    return json({ error: "Acțiune necunoscută. Folosește /students sau /resolve-badge." }, 404);
  } catch (err) {
    return json({ error: err instanceof Error ? err.message : "Eroare necunoscută" }, 500);
  }
});
