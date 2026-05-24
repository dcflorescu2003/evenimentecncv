import { supabase } from "@/integrations/supabase/client";

export interface TeacherInitialEntry {
  initials: string;
  first_name: string;
  last_name: string;
}

export type TeacherInitialsMap = Map<string, string[]>;

/** Build a map: normalized initials → list of full names ("Nume Prenume"). */
export function buildInitialsMap(rows: TeacherInitialEntry[]): TeacherInitialsMap {
  const m: TeacherInitialsMap = new Map();
  for (const r of rows) {
    const key = (r.initials ?? "").trim();
    if (!key) continue;
    const fullName = `${r.last_name} ${r.first_name}`.trim();
    const arr = m.get(key) ?? [];
    if (!arr.includes(fullName)) arr.push(fullName);
    m.set(key, arr);
  }
  return m;
}

/** Resolve a teacher cell text: if initials match exactly one teacher, return full name; else return original. */
export function resolveTeacherDisplay(
  raw: string | null | undefined,
  map: TeacherInitialsMap,
): string {
  const value = (raw ?? "").trim();
  if (!value) return "";
  const matches = map.get(value);
  if (matches && matches.length === 1) return matches[0];
  return value;
}

/** Fetch teacher initials map from the secure RPC. Returns an empty map on failure. */
export async function fetchTeacherInitialsMap(): Promise<TeacherInitialsMap> {
  const { data, error } = await supabase.rpc("get_teacher_initials_map");
  if (error || !data) return new Map();
  return buildInitialsMap(data as TeacherInitialEntry[]);
}
