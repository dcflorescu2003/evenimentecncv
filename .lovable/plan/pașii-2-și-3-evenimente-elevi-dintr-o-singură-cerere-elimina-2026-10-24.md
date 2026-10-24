# Pașii 2 și 3: evenimente elevi dintr-o singură cerere + eliminarea căilor vechi

## Ce se schimbă pentru utilizatori
- Lista de evenimente, detaliul unui eveniment și panoul elevului se încarcă dintr-o singură cerere rapidă, nu din 3–4 cereri lente.
- Înscrierea și reînscrierea elevului se fac într-un singur pas pe server (verificare, rezervare, bilet). Nu mai pot apărea rezervări „pe jumătate”.
- Pe ecranul de participanți al coordonatorului, marcarea prezenței folosește aceeași cale rapidă ca la profesori (fără erori de „timeout”).
- Cine ce vede și regulile de înscriere (eligibilitate, locuri, suprapuneri, 4 ore/zi) rămân identice.

## Pasul 2 — citiri directe din baza de date
1. Funcție nouă „evenimentele mele disponibile”: întoarce evenimentele publicate eligibile pentru elevul conectat, cu locurile ocupate și rezervarea/biletul lui atașate.
2. Funcție nouă „detaliu eveniment pentru elev”: evenimentul + rezervarea și biletul elevului.
3. Paginile elevului (Evenimente, Detaliu eveniment, Panou) le folosesc în locul citirilor separate din evenimente / rezervări / bilete.

## Pasul 3 — eliminarea căilor vechi
1. Funcție nouă „înscrie-mă / renunț”: verifică eligibilitatea, creează sau reactivează rezervarea, iar biletul îl creează automat serverul (cod QR nou la reactivare). Renunțarea anulează rezervarea și biletul.
2. Se elimină din aplicație toate scrierile directe în bilete (creare/actualizare) din paginile elevului.
3. Pagina de participanți a coordonatorului trece pe `set_ticket_attendance` / `set_public_ticket_attendance`.
4. Pentru telefoanele cu versiune veche: scrierile directe vechi continuă să funcționeze (nu le blocăm), ca să nu stricăm aplicațiile neactualizate. Recomand o versiune nouă (bump 1.33) după implementare.

## Verificare
- Măsor durata funcțiilor noi pe date reale (țintă: sub 100 ms față de 1,1–2,2 s).
- Test ca elev: listă, detaliu, înscriere, renunțare, reînscriere — biletul apare imediat.
- Caut în cod să nu mai existe scrieri directe în bilete.

## Detalii tehnice
- RPC-uri SECURITY DEFINER, `search_path` fix, filtrate pe `auth.uid()`: `list_student_events(_session_id)`, `get_student_event(_event_id)`, `student_book_event(_event_id)` (apelează `check_booking_eligibility`, `INSERT ... ON CONFLICT` / reactivare, trigger `ensure_ticket_for_reservation` + regenerare `qr_code_data`), `student_cancel_reservation(_event_id)`.
- Eligibilitate în listă reutilizează logica existentă din politicile de vizibilitate (clase selectate prevalează asupra anilor).
- Fișiere: `src/pages/student/StudentEventsPage.tsx`, `StudentEventDetailPage.tsx`, `StudentDashboard.tsx`, `src/pages/coordinator/EventParticipantsPage.tsx`; regulă nouă în `AGENTS.md`.
- Rapoartele care citesc bilete în bucăți nu se modifică acum.
