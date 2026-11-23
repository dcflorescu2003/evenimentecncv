export type TimetableView = "mine" | "rooms" | "staff" | "classes";

export function timetableViewsForRoles(roles: readonly string[]): TimetableView[] {
  if (roles.includes("cse")) return ["rooms"];
  if (roles.includes("teacher") || roles.includes("homeroom_teacher")) return ["mine", "rooms", "staff", "classes"];
  if (roles.includes("admin")) return ["classes"];
  return [];
}