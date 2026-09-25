# Doar sesiunile active la crearea/editarea evenimentelor

## Ce se schimbă
În formularul de eveniment (admin și profesor/diriginte), lista „Sesiune” va afișa doar sesiunile cu status **activ**.

- La creare: se preselectează prima sesiune activă. Dacă nu există nicio sesiune activă, butonul „Eveniment nou” e dezactivat, cu mesajul „Nu există nicio sesiune activă”.
- La editarea unui eveniment dintr-o sesiune care nu mai e activă: sesiunea lui curentă rămâne afișată în listă (marcată „inactivă”), ca să nu se piardă, dar nu se pot alege alte sesiuni inactive.
- Filtrele de listare și numele sesiunii din tabele rămân neschimbate (se văd în continuare toate sesiunile, pentru istoric).

## Detalii tehnice
- `src/pages/admin/EventsPage.tsx` (select ~l.527, openCreate l.214, buton l.361)
- `src/pages/prof/ProfEventsPage.tsx` (select ~l.439, openCreate l.208, buton l.321)
- `src/pages/prof/ProfEventDetailPage.tsx` (select editare ~l.1572)
- Derivare `activeSessions = sessions.filter(s => s.status === "active")`, plus sesiunea curentă a formularului la editare. Fără modificări în baza de date.
