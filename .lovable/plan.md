## Modificare afișare locuri libere (public)

Înlocuim formatul `X / Y locuri libere` cu `X locuri libere` peste tot unde este vizibil publicului.

### Fișiere de modificat
1. **`src/pages/public/PublicEventsPage.tsx`** — linia cu `Math.max(0, e.max_capacity - (reservationCounts[e.id] || 0))} / {e.max_capacity} locuri libere` → doar `{availableSeats} locuri libere`.
2. **`src/pages/public/PublicEventBookingPage.tsx`** — linia `{spotsLeft} / {event.max_capacity} locuri libere` → `{spotsLeft} locuri libere`.
3. **`src/pages/Login.tsx`** — în card-urile de evenimente publice, `{availableSeats} / {e.max_capacity} locuri libere` → `{availableSeats} locuri libere`.

### Neatins
- Paginile interne (admin/manager/prof/student) păstrează formatul actual cu capacitatea totală — modificarea e doar pe fluxul public.
