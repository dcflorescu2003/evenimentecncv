import { supabase } from "@/integrations/supabase/client";

export type AppRoleName =
  | "admin"
  | "student"
  | "homeroom_teacher"
  | "coordinator_teacher"
  | "teacher"
  | "manager"
  | "cse";

export const STAFF_ROLES: AppRoleName[] = [
  "teacher",
  "homeroom_teacher",
  "coordinator_teacher",
  "cse",
];

export interface ProfileSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  username: string;
  display_name: string | null;
  roles: string[];
}

/** Normalizează un text pentru comparații locale: fără diacritice, litere mici. */
export function normalizeText(value: string | null | undefined): string {
  return (value ?? "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[șşŞȘ]/g, "s")
    .replace(/[țţŢȚ]/g, "t")
    .toLowerCase();
}

/** Adevărat dacă textul conține termenul, ignorând diacriticele și majusculele. */
export function matchesSearch(term: string, ...fields: (string | null | undefined)[]) {
  const q = normalizeText(term).trim();
  if (!q) return true;
  return fields.some((f) => normalizeText(f).includes(q));
}

/**
 * Caută persoane pe server: ignoră diacriticele, caută și în numele complet,
 * filtrează după rol înainte de limitare.
 */
export async function searchProfiles(
  term: string,
  roles?: AppRoleName[],
  limit = 20,
): Promise<ProfileSearchResult[]> {
  if (term.trim().length < 2) return [];
  const { data, error } = await supabase.rpc("search_profiles", {
    _term: term.trim(),
    _roles: (roles ?? null) as never,
    _limit: limit,
  });
  if (error) throw error;
  return ((data ?? []) as ProfileSearchResult[]).map((p) => ({
    ...p,
    roles: p.roles ?? [],
  }));
}
