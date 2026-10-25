const KEY = "cncv_redirect_after_login";

/** Ține minte pagina cerută înainte de autentificare (ex. link partajat de eveniment). */
export function rememberRedirect(path: string) {
  if (!path || path === "/" || path.startsWith("/login") || path.startsWith("/change-password")) return;
  try { sessionStorage.setItem(KEY, path); } catch { /* ignore */ }
}

export function consumeRedirect(fallback = "/app"): string {
  try {
    const p = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (p && p.startsWith("/")) return p;
  } catch { /* ignore */ }
  return fallback;
}

export function eventShareUrl(eventId: string) {
  return `${window.location.origin}/e/${eventId}`;
}

export function clubShareUrl(clubId: string) {
  return `${window.location.origin}/c/${clubId}`;
}

export function volunteerShareUrl(projectId: string) {
  return `${window.location.origin}/v/${projectId}`;
}

export function feedbackShareUrl(formId: string) {
  return `${window.location.origin}/f/${formId}`;
}
