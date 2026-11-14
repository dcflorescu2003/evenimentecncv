export type TimetableView = "mine" | "rooms" | "staff";

export function timetableViewsForRoles(roles: readonly string[]): TimetableView[] {
  if (roles.includes("cse")) return ["rooms"];
  if (roles.includes("teacher") || roles.includes("homeroom_teacher")) return ["mine", "rooms", "staff"];
  return [];
}