

## Plan: Deschidere rezervări + mesaj de eroare clar

### 1. Actualizare `booking_open_at` pentru evenimentele „Ziua Portilor deschise"

Folosind un UPDATE pe toate evenimentele publice cu `booking_open_at = '2026-04-22 13:00:00+00'`, setez `booking_open_at` la `now()` (adică imediat deschise).

### 2. Corectare afișare oră în Edge Function — fus orar București

**`supabase/functions/public-book-event/index.ts`**

Funcția `formatDt` folosește `new Date().getHours()` care returnează ora UTC (Deno rulează în UTC). Voi converti explicit la fusul orar `Europe/Bucharest` folosind `Intl.DateTimeFormat` sau `toLocaleString('ro-RO', { timeZone: 'Europe/Bucharest' })`.

### 3. Mesaj de eroare vizibil pe client

**`src/pages/public/PublicEventBookingPage.tsx`**

`supabase.functions.invoke()` nu pune body-ul în `data` când statusul e non-2xx — pune un obiect generic în `error`. Trebuie extras mesajul real din eroarea returnată:

```typescript
// Actual fix:
if (error) {
  // FunctionsHttpError contains the response context
  const errorBody = error.context?.body 
    ? JSON.parse(await error.context.text())
    : null;
  throw new Error(errorBody?.error || error.message || "Eroare la rezervare");
}
```

Alternativ, mai simplu: schimb Edge Function-ul să returneze `status: 200` cu un câmp `error` în JSON (pattern deja folosit în alte funcții), iar clientul verifică `data.error`.

**Abordare aleasă**: Modific edge function-ul să returneze 200 cu `{ error: "..." }` pentru erorile de validare (booking window, capacitate, etc.), păstrând 500 doar pentru erori reale de server. Clientul deja verifică `data.error` pe linia 89.

### Fișiere modificate
- `supabase/functions/public-book-event/index.ts` — status 200 cu `error` field pentru validări + formatare oră București
- `src/pages/public/PublicEventBookingPage.tsx` — fără modificări (logica `data.error` există deja)

### Date actualizate
- UPDATE pe `public_reservations` / `events` — `booking_open_at = now()` pentru evenimentele blocate

