

## Plan: Buton „Anulează toate biletele" în tab-ul Contact

### Ce se adaugă

**`src/pages/admin/EventDetailPage.tsx`** — tab-ul Contact

- Adaug o coloană nouă „Acțiuni" în tabel
- Fiecare rând primește un buton „Anulează toate" (icon Trash2) care va:
  - Seta `setCancelReservation` cu un nou flag (ex. `cancelAll: true`) + `publicReservationId` = `pr.id` + `name` = `pr.guest_name`
  - Butonul apare doar dacă `ticketCount > 0` (are bilete active)
- Rândurile cu `ticketCount === 0` afișează un badge „Anulat" în loc de buton

### Logica de anulare (în AlertDialog-ul existent)

- Când `cancelReservation.cancelAll === true`:
  - Update toate biletele din `public_tickets` unde `public_reservation_id = pr.id` la `status = 'cancelled'`
  - Update `public_reservations` cu `status = 'cancelled'` pentru acel `pr.id`
  - Audit log cu `action: "all_tickets_cancelled_by_admin"`, `entity_type: "public_reservation"`, `entity_id: pr.id`
  - Invalidate queries + toast succes
- Mesajul din dialog se adaptează: „Toate biletele pentru **{name}** vor fi anulate"

### Detalii tehnice

- State-ul `cancelReservation` se extinde cu proprietatea opțională `cancelAll?: boolean`
- Se reutilizează AlertDialog-ul existent, adăugând o ramură `if (cancelReservation.cancelAll)` în handler-ul onClick
- Nu e nevoie de schema DB nouă — `public_reservations.status` și `public_tickets.status` suportă deja valoarea `'cancelled'`
- RLS: admin-ul are deja politică `ALL` pe ambele tabele

### Fișiere modificate
- `src/pages/admin/EventDetailPage.tsx` — coloană Acțiuni + logică anulare în bulk

### Ce NU se schimbă
- Schema DB, RLS, edge functions

