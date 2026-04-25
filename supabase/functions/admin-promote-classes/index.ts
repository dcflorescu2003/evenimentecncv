import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const ROMAN: Record<number, string> = {
  5: "V", 6: "VI", 7: "VII", 8: "VIII", 9: "IX", 10: "X", 11: "XI", 12: "XII",
};

async function deleteStudent(supabase: any, userId: string) {
  // reservations -> tickets -> attendance_log
  const { data: reservationIds } = await supabase
    .from("reservations").select("id").eq("student_id", userId);
  if (reservationIds && reservationIds.length > 0) {
    const resIds = reservationIds.map((r: any) => r.id);
    const { data: ticketIds } = await supabase
      .from("tickets").select("id").in("reservation_id", resIds);
    if (ticketIds && ticketIds.length > 0) {
      const tIds = ticketIds.map((t: any) => t.id);
      await supabase.from("attendance_log").delete().in("ticket_id", tIds);
      await supabase.from("tickets").delete().in("id", tIds);
    }
    await supabase.from("reservations").delete().eq("student_id", userId);
  }
  await supabase.from("form_submissions").delete().eq("student_id", userId);
  await supabase.from("event_student_assistants").delete().eq("student_id", userId);
  await supabase.from("student_class_assignments").delete().eq("student_id", userId);
  await supabase.from("notifications").delete().eq("user_id", userId);
  await supabase.from("push_subscriptions").delete().eq("user_id", userId);
  await supabase.from("fcm_tokens").delete().eq("user_id", userId);
  await supabase.from("user_roles").delete().eq("user_id", userId);
  await supabase.from("profiles").delete().eq("id", userId);
  await supabase.auth.admin.deleteUser(userId);
}

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

    // Auth + admin check
    const authHeader = req.headers.get("Authorization") || "";
    const token = authHeader.replace("Bearer ", "");
    if (!token || token === serviceRoleKey) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const { data: isAdmin } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" });
    if (!isAdmin) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Body
    const body = await req.json().catch(() => ({}));
    const newYear: string = body?.new_academic_year;
    if (!newYear || !/^\d{4}-\d{4}$/.test(newYear)) {
      return new Response(JSON.stringify({ error: "Anul școlar invalid (ex: 2026-2027)" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load all classes
    const { data: allClasses, error: classErr } = await supabase
      .from("classes").select("id, grade_number, section, display_name, homeroom_teacher_id");
    if (classErr) throw classErr;

    const byGrade: Record<number, any[]> = {};
    (allClasses || []).forEach((c: any) => {
      (byGrade[c.grade_number] = byGrade[c.grade_number] || []).push(c);
    });

    // Step 1: delete graduating students (grade 8 and 12)
    const graduatingClassIds = [...(byGrade[8] || []), ...(byGrade[12] || [])].map((c) => c.id);
    let deletedStudents = 0;
    if (graduatingClassIds.length > 0) {
      const { data: assigns } = await supabase
        .from("student_class_assignments")
        .select("student_id")
        .in("class_id", graduatingClassIds);
      const studentIds = Array.from(new Set((assigns || []).map((a: any) => a.student_id)));
      for (const sid of studentIds) {
        try {
          await deleteStudent(supabase, sid);
          deletedStudents += 1;
        } catch (e) {
          console.error("Failed to delete student", sid, e);
        }
      }
    }

    // Step 2: convert grade 8 -> 5 (empty, keep teacher) and 12 -> 9
    let convertedClasses = 0;
    for (const cls of (byGrade[8] || [])) {
      const section = cls.section || "";
      await supabase.from("classes").update({
        grade_number: 5,
        display_name: section ? `V ${section}` : "V",
        academic_year: newYear,
      }).eq("id", cls.id);
      convertedClasses += 1;
    }
    for (const cls of (byGrade[12] || [])) {
      const section = cls.section || "";
      await supabase.from("classes").update({
        grade_number: 9,
        display_name: section ? `IX ${section}` : "IX",
        academic_year: newYear,
      }).eq("id", cls.id);
      convertedClasses += 1;
    }

    // Step 3: promote 5->6, 6->7, 7->8 and 9->10, 10->11, 11->12
    // Process descending to avoid colliding with classes we just created at lower grades.
    let promotedClasses = 0;
    const orderedGrades = [11, 10, 9, 7, 6, 5];
    for (const g of orderedGrades) {
      for (const cls of (byGrade[g] || [])) {
        const newGrade = g + 1;
        const section = cls.section || "";
        const newName = section ? `${ROMAN[newGrade]} ${section}` : ROMAN[newGrade];
        await supabase.from("classes").update({
          grade_number: newGrade,
          display_name: newName,
          academic_year: newYear,
        }).eq("id", cls.id);
        promotedClasses += 1;
      }
    }

    // Step 4: bring all remaining student_class_assignments to new academic year
    await supabase.from("student_class_assignments")
      .update({ academic_year: newYear })
      .neq("academic_year", newYear);

    // Audit log
    await supabase.from("audit_logs").insert({
      user_id: user.id,
      entity_type: "classes",
      action: "promote_classes",
      details: {
        new_academic_year: newYear,
        promoted_classes: promotedClasses,
        converted_classes: convertedClasses,
        deleted_students: deletedStudents,
      },
    });

    return new Response(JSON.stringify({
      success: true,
      promoted_classes: promotedClasses,
      converted_classes: convertedClasses,
      deleted_students: deletedStudents,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (err) {
    console.error("admin-promote-classes error", err);
    return new Response(JSON.stringify({ error: (err as Error).message || "Eroare internă" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
