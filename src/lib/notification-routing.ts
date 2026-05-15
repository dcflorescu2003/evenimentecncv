type AppRole =
  | "admin"
  | "student"
  | "homeroom_teacher"
  | "coordinator_teacher"
  | "teacher"
  | "manager"
  | "cse";

interface NotificationLike {
  type?: string | null;
  related_event_id?: string | null;
}

/**
 * Mapează o notificare la ruta relevantă în funcție de rolurile utilizatorului.
 * Returnează null dacă nu există o destinație utilă (ex: lipsă related_event_id).
 */
export function getNotificationUrl(
  notification: NotificationLike,
  roles: AppRole[]
): string | null {
  const eventId = notification.related_event_id;
  const type = notification.type;

  // Tipuri specifice pentru elev
  if (type === "morning_reminder" || type === "event_reminder") {
    if (roles.includes("student") && eventId) {
      return `/student/events/${eventId}`;
    }
  }

  // Tipul pentru diriginte (alertă absențe după închiderea evenimentului)
  if (type === "homeroom_absence_alert" && eventId) {
    if (
      roles.includes("homeroom_teacher") ||
      roles.includes("teacher") ||
      roles.includes("cse")
    ) {
      return `/prof/events/${eventId}`;
    }
  }

  // Fallback generic pe baza rolului (prioritate descrescătoare)
  if (eventId) {
    if (roles.includes("admin")) return `/admin/events/${eventId}`;
    if (roles.includes("teacher") || roles.includes("homeroom_teacher") || roles.includes("cse")) {
      return `/prof/events/${eventId}`;
    }
    if (roles.includes("coordinator_teacher")) return `/coordinator/event/${eventId}`;
    if (roles.includes("student")) return `/student/events/${eventId}`;
    if (roles.includes("manager")) return `/manager/events`;
  }

  return null;
}
