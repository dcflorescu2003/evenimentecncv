import { supabase } from "@/integrations/supabase/client";
import { PORTFOLIO_BUCKET, PORTFOLIO_MAX_FILE_SIZE } from "./portfolio";

export type CompetitionType = "scolar" | "judetean" | "national" | "international" | "online" | "altul";
export type CompetitionDifficulty = "usor" | "mediu" | "greu";
export type CompetitionTeamMode = "individual" | "echipa";
export type CompetitionStatus = "active" | "closed" | "archived";
export type SignupStatus = "interested" | "selected" | "registered" | "participated";

export const COMPETITION_TYPE_LABELS: Record<CompetitionType, string> = {
  scolar: "Școlar",
  judetean: "Județean",
  national: "Național",
  international: "Internațional",
  online: "Online",
  altul: "Altul",
};

export const COMPETITION_DIFFICULTY_LABELS: Record<CompetitionDifficulty, string> = {
  usor: "Ușor",
  mediu: "Mediu",
  greu: "Greu",
};

export const COMPETITION_TEAM_LABELS: Record<CompetitionTeamMode, string> = {
  individual: "Individual",
  echipa: "Echipă",
};

export const COMPETITION_STATUS_LABELS: Record<CompetitionStatus, string> = {
  active: "Activ",
  closed: "Închis",
  archived: "Arhivat",
};

export const SIGNUP_STATUS_LABELS: Record<SignupStatus, string> = {
  interested: "Interesat",
  selected: "Selectat",
  registered: "Înscris",
  participated: "A participat",
};

export const SIGNUP_STATUS_ORDER: SignupStatus[] = [
  "interested",
  "selected",
  "registered",
  "participated",
];

export const AWARD_OPTIONS = [
  "Premiul I",
  "Premiul II",
  "Premiul III",
  "Mențiune",
  "Participare",
];

export function signupStatusColor(s: string) {
  switch (s) {
    case "participated": return "text-green-700 dark:text-green-400";
    case "registered": return "text-blue-700 dark:text-blue-400";
    case "selected": return "text-amber-700 dark:text-amber-400";
    default: return "text-muted-foreground";
  }
}

export async function uploadCompetitionFile(
  signupId: string,
  kind: "diploma" | "project",
  file: File,
) {
  if (file.size > PORTFOLIO_MAX_FILE_SIZE) {
    throw new Error(`Fișierul „${file.name}" depășește 10 MB.`);
  }
  const safe = file.name.replace(/[^\w.\-]/g, "_");
  const path = `competitions/${signupId}/${kind}/${Date.now()}_${safe}`;
  const { error } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return { path, name: file.name, size: file.size, type: file.type };
}
