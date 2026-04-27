## Ce vom face

Email-ul este deja obligatoriu la rezervările publice. Adăugăm:
1. Trimiterea automată a unui email de confirmare cu un **link unic** către pagina personală de bilete.
2. Pe pagina de bilete: posibilitatea de **anulare** a unui bilet individual sau a întregii rezervări.

## Flux pentru utilizator

1. Vizitatorul rezervă bilete pe `/public/events/:id` → primește pe email un mesaj cu:
   - Detaliile evenimentului
   - Codul rezervării
   - Un link direct: `https://.../public/tickets/<reservation_code>` (deschide pagina cu QR-uri și status)
2. Pe pagina de bilete (link-ul din email), pe lângă printare apar butoane:
   - „Anulează acest bilet” pe fiecare bilet (cu confirmare)
   - „Anulează toată rezervarea” jos
3. La anulare, locul devine din nou disponibil (ticketul trece pe `cancelled`, iar dacă toate sunt anulate, rezervarea trece pe `cancelled`).

## Ce schimbăm tehnic

### 1. Email de confirmare
- Folosim infrastructura de email Lovable (deja configurată pe `notify.pyroskill.info`).
- Modificăm `supabase/functions/public-book-event/index.ts` ca, după ce creează rezervarea, să **enqueue** un email către `guest_email` cu link-ul `/public/tickets/<reservation_code>` și sumar bilete.
- Template HTML simplu, în română, cu logo-ul CNCV și link clar de management.

### 2. Anulare bilete (acces public, fără login)
Pentru securitate, anularea trebuie să meargă prin edge function (RLS curent nu permite UPDATE pentru `anon` pe `public_tickets` / `public_reservations`). Cream o nouă edge function: `public-cancel-ticket`.
- Input: `reservation_code` + opțional `ticket_id` (dacă lipsește → anulează toată rezervarea).
- Validează că `reservation_code` există, marchează ticket(s) ca `cancelled`, iar dacă nu mai rămâne niciun ticket activ marchează și rezervarea ca `cancelled`.
- Refuză anularea dacă evenimentul a trecut deja.

### 3. UI pe `PublicTicketViewPage.tsx`
- Adăugăm butoane „Anulează” cu `AlertDialog` de confirmare.
- După anulare, refetch query.
- Ascundem butoanele dacă status-ul e deja `cancelled` sau dacă evenimentul a trecut.

### 4. (Opțional minor) UI pe pagina de confirmare după rezervare
- Adăugăm un mesaj: „Ți-am trimis pe email un link cu biletele tale.”

## Fișiere atinse

- `supabase/functions/public-book-event/index.ts` — enqueue email după succes
- `supabase/functions/public-cancel-ticket/index.ts` — **nou**, anulare securizată
- `supabase/config.toml` — declarare funcție nouă cu `verify_jwt = false`
- `src/pages/public/PublicTicketViewPage.tsx` — butoane de anulare
- `src/pages/public/PublicEventBookingPage.tsx` — mesaj „verifică emailul”

## Observații

- Email-ul deja este validat ca format și obligatoriu — nu e nevoie de migrație în baza de date.
- Codul de rezervare (`reservation_code`) este UUID — suficient de greu de ghicit pentru a fi folosit ca „token” de management.
- Nu modificăm structura tabelelor.
