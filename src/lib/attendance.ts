/**
 * Determines automatic attendance status based on current time vs event start_time.
 * - If now <= start_time + 15min → "present"
 * - If now > start_time + 15min → "late"
 */
export function determineAutoStatus(
  eventDate: string,
  eventStartTime: string
): "present" | "late" {
  const [hours, minutes] = eventStartTime.split(":").map(Number);
  const eventStart = new Date(`${eventDate}T${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:00`);
  const cutoff = new Date(eventStart.getTime() + 15 * 60 * 1000);
  return new Date() <= cutoff ? "present" : "late";
}
