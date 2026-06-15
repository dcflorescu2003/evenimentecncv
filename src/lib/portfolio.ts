import { supabase } from "@/integrations/supabase/client";

export const PORTFOLIO_BUCKET = "portfolio-files";
export const PORTFOLIO_MAX_FILE_SIZE = 10 * 1024 * 1024; // 10MB

export function validatePortfolioFile(file: File): string | null {
  if (file.size > PORTFOLIO_MAX_FILE_SIZE) {
    return `Fișierul „${file.name}" depășește 10 MB.`;
  }
  return null;
}

export async function uploadSubmissionFile(submissionId: string, file: File) {
  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const path = `submissions/${submissionId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return { path, name: file.name, size: file.size, type: file.type };
}

export async function uploadItemFile(itemId: string, file: File) {
  const safeName = file.name.replace(/[^\w.\-]/g, "_");
  const path = `items/${itemId}/${Date.now()}_${safeName}`;
  const { error } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (error) throw error;
  return { path, name: file.name, size: file.size, type: file.type };
}

export async function getPortfolioFileUrl(path: string, expiresIn = 3600) {
  const { data, error } = await supabase.storage
    .from(PORTFOLIO_BUCKET)
    .createSignedUrl(path, expiresIn);
  if (error) throw error;
  return data.signedUrl;
}

export async function deletePortfolioFile(path: string) {
  const { error } = await supabase.storage.from(PORTFOLIO_BUCKET).remove([path]);
  if (error) throw error;
}

export function formatBytes(bytes?: number | null): string {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function statusLabel(status: string) {
  switch (status) {
    case "pending": return "În așteptare";
    case "approved": return "Aprobat";
    case "rejected": return "Respins";
    default: return status;
  }
}

export function statusColor(status: string) {
  switch (status) {
    case "approved": return "text-green-700 dark:text-green-400";
    case "rejected": return "text-destructive";
    default: return "text-amber-700 dark:text-amber-400";
  }
}
