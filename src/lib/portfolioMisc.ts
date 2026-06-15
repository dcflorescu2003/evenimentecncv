import { supabase } from "@/integrations/supabase/client";
import { PORTFOLIO_BUCKET, PORTFOLIO_MAX_FILE_SIZE } from "./portfolio";

export const DOCUMENT_CATEGORIES: Record<string, string> = {
  planificari: "Planificări",
  programe: "Programe școlare",
  planuri_lectie: "Planuri de lecție",
  fise_lucru: "Fișe de lucru",
  fise_evaluare: "Fișe de evaluare",
  teste: "Teste",
  fise_observatie: "Fișe de observație",
  procese_verbale: "Procese verbale",
  rapoarte: "Rapoarte",
  regulamente: "Regulamente / proceduri",
  dosare_concurs: "Dosare concurs",
  fise_postare: "Fișe postare",
  altele: "Altele",
};

export const DOCUMENT_STATUSES: Record<string, string> = {
  in_progress: "În lucru",
  done: "Finalizat",
  archived: "Arhivat",
};

export const JOURNAL_TYPES: Record<string, string> = {
  lectie: "Lecție",
  activitate_extras: "Activitate extrașcolară",
  sedinta: "Ședință",
  intalnire_parinti: "Întâlnire cu părinții",
  voluntariat: "Voluntariat",
  concurs: "Concurs",
  proiect: "Proiect",
  vizita: "Vizită / excursie",
  training: "Training / curs",
  observatie: "Observație",
  alta: "Altă activitate",
};

export const TEACHER_ITEM_CATEGORIES: Record<string, string> = {
  cv: "CV",
  adeverinta: "Adeverință",
  certificat: "Certificat",
  diploma: "Diplomă personală",
  curs: "Curs / formare",
  proiect: "Proiect",
  raport: "Raport",
  material_didactic: "Material didactic",
  aplicatie: "Aplicație",
  comisie: "Apartenență comisie",
  altele: "Altele",
};

type FileKind = "documents" | "journal" | "teacher-items" | "student-diplomas";

export async function uploadPortfolioMiscFile(
  kind: FileKind,
  ownerId: string,
  file: File,
) {
  if (file.size > PORTFOLIO_MAX_FILE_SIZE) {
    throw new Error(`Fișierul „${file.name}" depășește 10 MB.`);
  }
  const safe = file.name.replace(/[^\w.\-]/g, "_");
  const path = `${kind}/${ownerId}/${Date.now()}_${safe}`;
  const { error } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return { path, name: file.name, size: file.size, type: file.type };
}

export function documentStatusColor(s: string) {
  switch (s) {
    case "done": return "text-green-700 dark:text-green-400";
    case "archived": return "text-muted-foreground";
    default: return "text-amber-700 dark:text-amber-400";
  }
}
