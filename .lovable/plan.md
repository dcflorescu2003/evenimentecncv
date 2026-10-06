# Modificări formular eveniment

## 1. Bifa „Eveniment public” doar pentru admin și CSE
- În formularele de creare/editare (profesor și detalii eveniment) bifa apare doar dacă utilizatorul are rol admin sau CSE.
- Profesorii și diriginții nu o mai văd; evenimentele lor se salvează ca interne. La editarea unui eveniment deja public de către un profesor, valoarea existentă se păstrează (nu se schimbă).
- Regula se aplică și în baza de date: o modificare care face un eveniment public sau îl scoate din public e refuzată dacă nu vine de la admin/CSE.

## 2. Câmpul „Număr locuri” gol inițial
- La eveniment nou câmpul pornește gol, cu tastatură numerică pe mobil; poți scrie direct numărul, fără să rămână blocat pe 1.
- La salvare: obligatoriu, număr întreg ≥ 1, altfel mesaj „Completează numărul de locuri”.
- Se aplică în toate cele trei formulare (admin, profesor, detalii eveniment).

## 3. Perioadă de înscriere implicită
- Dacă „Înscriere de la” e gol, se salvează momentul salvării (crearea evenimentului).
- Dacă „Înscriere până la” e gol, se salvează data și ora de sfârșit a evenimentului.
- Sub câmpuri apare explicația: „Dacă lași gol, înscrierea e deschisă de acum până la sfârșitul evenimentului.”
- Valorile se completează și în baza de date (la inserare), ca regula să funcționeze indiferent de formular. Evenimentele existente nu se modifică.

## 4. Elevi asistenți doar dintre participanți
- Există deja: lista „Adaugă elev asistent” arată doar elevii înscriși, iar baza de date refuză un asistent neînscris. Verific doar că e la fel pe paginile de profesor, diriginte și coordonator; nicio schimbare dacă e așa.

## Detalii tehnice
- Fișiere: `src/pages/admin/EventsPage.tsx`, `src/pages/prof/ProfEventsPage.tsx`, `src/pages/prof/ProfEventDetailPage.tsx`.
- `max_capacity` în starea formularului devine `number | ""`; input `inputMode="numeric"`, validare la submit.
- Bifa publică afișată cu `hasRole('admin') || hasRole('cse')` din `useAuth`.
- Migrație: trigger BEFORE INSERT/UPDATE pe `events` care (a) blochează schimbarea `is_public` de către non-admin/non-CSE, (b) setează `booking_open_at = now()` și `booking_close_at = (date + end_time) Europe/Bucharest` când sunt NULL la inserare.
- Bump de versiune la final (fix în codul inclus în aplicațiile mobile).
