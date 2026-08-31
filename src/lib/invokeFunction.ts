import { supabase } from "@/integrations/supabase/client";

/**
 * Invocă o funcție edge asigurând că sesiunea curentă este validă.
 * - reîmprospătează sesiunea dacă a expirat
 * - extrage mesajul de eroare real din răspunsul non-2xx (altfel sonner ar
 *   afișa doar "Edge Function returned a non-2xx status code")
 */
export async function invokeFunction<T = any>(
  name: string,
  body: Record<string, unknown>,
): Promise<T> {
  const { data: sessionData } = await supabase.auth.getSession();
  let session = sessionData.session;

  const expiresAt = session?.expires_at ? session.expires_at * 1000 : 0;
  if (session && expiresAt - Date.now() < 60_000) {
    const { data: refreshed } = await supabase.auth.refreshSession();
    session = refreshed.session ?? session;
  }

  if (!session) {
    throw new Error("Sesiune expirată. Reautentificați-vă și încercați din nou.");
  }

  const { data, error } = await supabase.functions.invoke(name, { body });

  if (error) {
    let message = error.message;
    const res = (error as { context?: Response }).context;
    if (res && typeof res.json === "function") {
      try {
        const payload = await res.clone().json();
        if (payload?.error) message = payload.error;
      } catch {
        /* răspuns fără corp JSON */
      }
      if (res.status === 401) {
        message = message || "Sesiune expirată. Reautentificați-vă și încercați din nou.";
      }
    }
    throw new Error(message);
  }

  if ((data as { error?: string } | null)?.error) {
    throw new Error((data as { error: string }).error);
  }

  return data as T;
}
