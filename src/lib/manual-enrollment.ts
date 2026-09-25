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
  enrolledByRole: "admin" | "organizer" | "coordinator";
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
  const { data, error } = await supabase.rpc("manually_enroll_event_student", {
    _event_id: eventId,
    _student_id: studentId,
  });
  if (error) return { ok: false, reason: error.message };

  const result = data as {
    ok?: boolean;
    reason?: string;
    reactivated?: boolean;
    reservation_id?: string;
  } | null;
  if (!result?.ok) return { ok: false, reason: result?.reason || "Înscrierea nu a putut fi realizată" };

  try {
    const title = result.reactivated ? "Rezervare reactivată" : "Ai un bilet nou";
    await supabase.functions.invoke("send-push-to-user", {
      body: { user_id: studentId, title, body: "Biletul tău este disponibil în cont.", url: "/student/tickets" },
    });
  } catch {
    // Notificarea din aplicație a fost deja salvată de operația securizată.
  }

  return {
    ok: true,
    reactivated: result.reactivated,
    reservationId: result.reservation_id,
  };
}

async function notifyStudent(
  eventId: string,
  studentId: string,
  ctx: EnrollContext,
  reactivated: boolean
) {
  try {
    const { data: event } = await supabase
      .from("events")
      .select("title, date, start_time")
      .eq("id", eventId)
      .maybeSingle();

    const title = reactivated ? "Rezervare reactivată" : "Ai un bilet nou";
    const roleLabel = ctx.enrolledByRole === "admin" ? "administrator" : ctx.enrolledByRole === "coordinator" ? "coordonator" : "organizator";

    let body: string;
    if (event) {
      const [y, m, d] = String(event.date).split("-");
      const dateStr = `${d}.${m}.${y}`;
      const time = String(event.start_time).slice(0, 5);
      body = `Ai fost înscris${reactivated ? " din nou" : ""} de către ${roleLabel} la „${event.title}" (${dateStr}, ora ${time}). Biletul este disponibil în contul tău.`;
    } else {
      body = `Ai fost înscris${reactivated ? " din nou" : ""} de către ${roleLabel} la un eveniment. Biletul este disponibil în contul tău.`;
    }

    await supabase.from("notifications").insert({
      user_id: studentId,
      title,
      body,
      type: "manual_enrollment",
      related_event_id: eventId,
    });

    // Best-effort web/FCM push
    try {
      await supabase.functions.invoke("send-push-to-user", {
        body: {
          user_id: studentId,
          title,
          body,
          url: "/student/tickets",
        },
      });
    } catch (e) {
      console.warn("Push send failed (non-fatal):", e);
    }
  } catch {
    /* best-effort */
  }
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
