import { supabase } from "@/integrations/supabase/client";

export type EnrollmentResult = {
  ok: boolean;
  reactivated?: boolean;
  reservationId?: string;
  reason?: string;
};

export type ClassEnrollmentSummary = {
  enrolled: number;
  skipped: number;
  reactivated: number;
  details: { studentName: string; reason: string }[];
};

interface EnrollContext {
  enrolledByUserId: string;
  enrolledByRole: "admin" | "homeroom_teacher";
}

/**
 * Manually enroll a student in an event.
 * - Checks eligibility via `check_booking_eligibility` RPC.
 * - Reactivates a cancelled reservation if found (regenerates ticket QR).
 * - Otherwise creates a new reservation + ticket.
 * - Logs the action in `audit_logs`.
 */
export async function enrollStudent(
  eventId: string,
  studentId: string,
  ctx: EnrollContext
): Promise<EnrollmentResult> {
  // 1. Check eligibility
  const { data: eligibility, error: eligErr } = await supabase.rpc(
    "check_booking_eligibility",
    { _student_id: studentId, _event_id: eventId }
  );
  if (eligErr) return { ok: false, reason: eligErr.message };

  const elig = eligibility as { allowed: boolean; reason?: string } | null;

  // 2. Look for an existing cancelled reservation to reactivate
  const { data: existing, error: existErr } = await supabase
    .from("reservations")
    .select("id, status")
    .eq("event_id", eventId)
    .eq("student_id", studentId)
    .maybeSingle();
  if (existErr && existErr.code !== "PGRST116") {
    return { ok: false, reason: existErr.message };
  }

  if (existing && existing.status === "cancelled") {
    // Eligibility check still must pass for capacity/overlap. If RPC blocked it for "ai deja o rezervare" we wouldn't be here (that's status='reserved').
    if (elig && !elig.allowed) {
      return { ok: false, reason: elig.reason || "Nu este eligibil" };
    }
    // Reactivate
    const { error: updErr } = await supabase
      .from("reservations")
      .update({ status: "reserved", cancelled_at: null })
      .eq("id", existing.id);
    if (updErr) return { ok: false, reason: updErr.message };

    // Regenerate ticket QR or create ticket if missing
    const { data: existingTicket } = await supabase
      .from("tickets")
      .select("id")
      .eq("reservation_id", existing.id)
      .maybeSingle();

    if (existingTicket) {
      const { error: tErr } = await supabase
        .from("tickets")
        .update({ status: "reserved", qr_code_data: crypto.randomUUID(), checkin_timestamp: null })
        .eq("id", existingTicket.id);
      if (tErr) return { ok: false, reason: tErr.message };
    } else {
      const { error: tErr } = await supabase
        .from("tickets")
        .insert({ reservation_id: existing.id, status: "reserved" });
      if (tErr) return { ok: false, reason: tErr.message };
    }

    await logEnrollment(eventId, studentId, existing.id, ctx, true);
    await notifyStudent(eventId, studentId, ctx, true);
    return { ok: true, reactivated: true, reservationId: existing.id };
  }

  // 3. Standard new enrollment — eligibility must pass
  if (elig && !elig.allowed) {
    return { ok: false, reason: elig.reason || "Nu este eligibil" };
  }

  const { data: newRes, error: insErr } = await supabase
    .from("reservations")
    .insert({ event_id: eventId, student_id: studentId, status: "reserved" })
    .select("id")
    .single();
  if (insErr) return { ok: false, reason: insErr.message };

  const { error: tErr } = await supabase
    .from("tickets")
    .insert({ reservation_id: newRes.id, status: "reserved" });
  if (tErr) return { ok: false, reason: tErr.message };

  await logEnrollment(eventId, studentId, newRes.id, ctx, false);
  return { ok: true, reactivated: false, reservationId: newRes.id };
}

async function logEnrollment(
  eventId: string,
  studentId: string,
  reservationId: string,
  ctx: EnrollContext,
  reactivated: boolean
) {
  // Best-effort; do not fail enrollment if audit insert fails (e.g. RLS for non-admins).
  try {
    await supabase.from("audit_logs").insert({
      user_id: ctx.enrolledByUserId,
      action: "manual_enrollment",
      entity_type: "reservation",
      entity_id: reservationId,
      details: {
        event_id: eventId,
        student_id: studentId,
        enrolled_by_role: ctx.enrolledByRole,
        reactivated,
      },
    });
  } catch {
    /* ignore */
  }
}

/**
 * Enroll all students of a class. Iterates through students, accumulates results.
 */
export async function enrollClass(
  eventId: string,
  classId: string,
  ctx: EnrollContext,
  studentNameResolver?: (studentId: string) => string
): Promise<ClassEnrollmentSummary> {
  const summary: ClassEnrollmentSummary = {
    enrolled: 0,
    skipped: 0,
    reactivated: 0,
    details: [],
  };

  // Fetch students of the class
  const { data: assignments, error } = await supabase
    .from("student_class_assignments")
    .select("student_id, profiles:student_id(first_name, last_name)")
    .eq("class_id", classId);
  if (error) {
    summary.details.push({ studentName: "—", reason: error.message });
    summary.skipped += 1;
    return summary;
  }

  for (const a of assignments || []) {
    const studentId = (a as any).student_id;
    const profile = (a as any).profiles;
    const name = studentNameResolver
      ? studentNameResolver(studentId)
      : profile
      ? `${profile.last_name || ""} ${profile.first_name || ""}`.trim()
      : studentId;

    const res = await enrollStudent(eventId, studentId, ctx);
    if (res.ok === true) {
      summary.enrolled += 1;
      if (res.reactivated) summary.reactivated += 1;
    } else {
      summary.skipped += 1;
      summary.details.push({ studentName: name, reason: res.reason });
    }
  }

  return summary;
}
