
## Plan: Înscriere clasă/elev de către diriginte și admin

Confirmat: **fluxul intern** (orice eveniment publicat, nu doar `is_public`).

### UI nou
**Pagina admin** (`EventDetailPage.tsx`) și **pagina diriginte** (`ProfEventDetailPage.tsx`), tab „Participanți" — două butoane noi lângă „Adaugă elev asistent":
- **Adaugă elev** — Combobox (Popover + Command) cu căutare server-side
  - Admin: caută în toți elevii activi
  - Diriginte: pre-filtrat la elevii propriei clase
- **Adaugă clasă** — Select cu confirm
  - Admin: dropdown toate clasele active
  - Diriginte: doar propria clasă

### Logică (helper nou `src/lib/manual-enrollment.ts`)
`enrollStudent(eventId, studentId)`:
1. Apelez RPC `check_booking_eligibility(studentId, eventId)` → dacă `allowed=false` returnez motivul.
2. Verific dacă există rezervare `cancelled` → o reactivez (UPDATE status `reserved`, regenerez QR pe ticket).
3. Altfel: INSERT `reservation` (status `reserved`) + INSERT `ticket` (status `reserved`, QR auto-generat de default).
4. INSERT `audit_logs` cu `action='manual_enrollment'`, detalii `{ enrolled_by_role, student_id, event_id }`.

`enrollClass(eventId, classId)`:
- Fetch elevi din clasă → loop `enrollStudent` cu acumulare rezultate → toast sumar `X înscriși, Y săriți (motive grupate)`.
- Confirm dialog înainte: „Vei înscrie N elevi din clasa Y. Continuă?"

### Migrație RLS (diriginte)
Admin are deja `Admins manage reservations/tickets`. Pentru diriginte adaug:
- `reservations` INSERT: dacă `student_id` ∈ elevii clasei lui (`homeroom_teacher_id = auth.uid()`)
- `reservations` UPDATE: idem (pentru reactivare cancelled→reserved)
- `tickets` INSERT: dacă `reservation_id` aparține unui elev al clasei lui
- `tickets` UPDATE: idem (regenerare QR la reactivare)

### Fișiere modificate
1. **Migrație nouă** — 4 politici RLS pentru diriginte (INSERT/UPDATE pe `reservations`, `tickets`).
2. `src/lib/manual-enrollment.ts` — helper nou (enrollStudent, enrollClass).
3. `src/pages/admin/EventDetailPage.tsx` — butoane + dialoguri + invalidare query participanți.
4. `src/pages/prof/ProfEventDetailPage.tsx` — butoane + dialoguri (limitate la clasa proprie).

### Ce NU se schimbă
- RPC `check_booking_eligibility` — se refolosește.
- Logica de generare QR / status default ticket — vine din schema (`gen_random_uuid()`).
- Pagini elev (biletul apare automat prin query existent pe `reservations`+`tickets`).
