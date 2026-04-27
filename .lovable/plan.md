# Limită opțională de elevi per clasă pentru evenimente

Adăugăm o setare opțională per eveniment: **„Maxim X elevi per clasă”**. Implicit nelimitat. Când e setată, regula se aplică doar la auto-rezervarea elevilor — dirigintele/admin-ul o pot depăși manual, iar asistenții nu se contorizează.

## 1. Bază de date (migrație)

- Adăugăm coloana `events.max_per_class` (`integer`, nullable, default `NULL` = fără limită).
- Actualizăm funcția RPC `check_booking_eligibility` astfel:
  - **Eliminăm** hard-code-ul existent pentru cele 2 meciuri (28.04 / 29.04).
  - **Înlocuim** cu o verificare generică: dacă `events.max_per_class IS NOT NULL`, numărăm rezervările active din clasa elevului pentru acel eveniment, **excluzând** elevii care apar în `event_student_assistants` pentru același eveniment. Dacă numărul `>= max_per_class`, întoarcem mesaj: *„Limita pentru clasa ta a fost atinsă (X locuri per clasă)”*.
- Funcția RPC e folosită doar la auto-rezervările elevilor (din `StudentEventDetailPage`). Diriginții și adminii inserează direct în `reservations` fără să apeleze RPC-ul, deci automat ignoră limita — exact ce ne dorim.

## 2. Formular creare/editare eveniment

Adăugăm câmpul în 2 locuri (același UX):
- `src/pages/admin/EventsPage.tsx`
- `src/pages/prof/ProfEventsPage.tsx`

Câmp nou în formular: **„Maxim elevi per clasă (opțional)”** — input numeric, gol = fără limită. Plasat lângă „Capacitate maximă”. Salvăm `null` dacă e gol, altfel valoarea integer.

## 3. Afișare în interfața elevului

Când `max_per_class` e setat, afișăm sub detaliile evenimentului textul:
> *„Maxim {X} elevi per clasă”*

Locații:
- `src/pages/student/StudentEventDetailPage.tsx` (cardul de detalii)
- `src/pages/student/StudentEventsPage.tsx` (lista cu evenimente, ca badge mic)
- `src/components/student/EventsCalendar.tsx` (popover-ul evenimentului)

## 4. Detalii tehnice

- Tipurile TypeScript pentru `events` se regenerează automat după migrație (`src/integrations/supabase/types.ts`).
- Nu modificăm `public-book-event` (rezervări publice anonime — nu au clasă).
- Mesajul de eroare în română, întors din RPC, este afișat de UI-ul existent fără modificări (folosește deja `result.reason`).

## Rezumat schimbări

- 1 migrație SQL (coloană nouă + actualizare funcție RPC)
- 2 formulare (admin, prof) — câmp nou
- 3 locații de afișare (elev) — text informativ
