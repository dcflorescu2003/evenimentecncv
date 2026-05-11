## Modificări pe pagina de rezervare publică

**Fișier:** `src/pages/public/PublicEventBookingPage.tsx`

### 1. Afișare locuri disponibile
- Adaug un `useQuery` care apelează RPC-ul `get_events_reserved_counts` cu `[id]` pentru a obține numărul de locuri ocupate (la fel ca în `PublicEventsPage` și `Login`).
- Calculez `spotsLeft = event.max_capacity - reservedCount`.
- Înlocuiesc textul `{event.max_capacity} locuri` din cardul evenimentului cu `{spotsLeft} / {event.max_capacity} locuri libere` (folosind `Math.max(0, spotsLeft)`).

### 2. Dezactivare buton când e plin
- Butonul „Rezervă X locuri" devine `disabled` dacă `spotsLeft <= 0` sau dacă `numTickets > spotsLeft`.
- Când e plin, textul butonului devine „Eveniment complet" (similar cu `StudentEventDetailPage`).
- Limitez și opțiunile din `Select` „Număr de locuri" la `Math.min(32, spotsLeft)` pentru a nu permite selectarea unui număr mai mare decât locurile rămase.

### Notă privind „oricare tip de eveniment"
- Pe `StudentEventDetailPage` butonul „Rezervă loc" este deja dezactivat când `spotsLeft <= 0` („Eveniment complet"). Nu e nevoie de modificări acolo.
- Pe pagina publică (singura care nu avea acest comportament) aplicăm logica de mai sus.

Nu e necesară nicio modificare la backend / edge function — `public-book-event` deja validează capacitatea și returnează eroare; modificările sunt doar la nivel UI pentru feedback vizual corect.