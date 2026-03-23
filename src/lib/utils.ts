import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/** Format a person's name as "Last_name First_name" */
export function formatName(
  profile?: { first_name?: string; last_name?: string; display_name?: string | null } | null
): string {
  if (!profile) return "";
  // Always use last_name + first_name order (display_name may be stored in wrong order)
  if (profile.last_name || profile.first_name) {
    return `${profile.last_name || ""} ${profile.first_name || ""}`.trim();
  }
  if (profile.display_name) return profile.display_name;
  return "";
}
