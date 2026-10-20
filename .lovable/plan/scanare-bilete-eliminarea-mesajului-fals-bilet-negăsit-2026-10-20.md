# Scanare bilete: eliminarea mesajului fals „Bilet negăsit”

## Ce se întâmplă
Evenimentul „Comori arhitecturale” are 40 de înscrieri și 42 de bilete, deci biletele există. La scanare, aplicația caută biletul direct în baza de date. Verificarea drepturilor trece prin aproape 3.000 de rezervări și uneori depășește timpul maxim, la fel ca la eroarea de la marcarea prezenței. Aplicația ignoră această eroare și afișează „Bilet negăsit.”, deși biletul este valid.

## Ce schimbăm
1. O funcție rapidă pe server, `scan_event_ticket(_event_id, _qr)`, face totul într-un singur pas:
   - găsește biletul de elev sau de vizitator;
   - verifică dacă biletul aparține evenimentului;
   - verifică dacă cel care scanează are drept: admin, organizator, coordonator sau elev asistent;
   - marchează automat „Prezent” sau „Întârziat”, după fereastra -30 min / +15 min;
   - scrie în istoricul prezențelor;
   - întoarce numele și statusul, sau un mesaj clar: „Deja procesat (Prezent)”, „Biletul nu aparține acestui eveniment”, „Bilet negăsit”.
2. Toate cele 4 ecrane de scanare (profesor/diriginte, coordonator, admin, elev asistent) vor folosi această funcție. Butoanele „Prezent/Întârziat” din fila Caută vor folosi `set_ticket_attendance` deja existentă, iar biletele de vizitator vor avea și ele suport.
3. Dacă apare totuși o eroare de rețea sau server, mesajul va fi „Eroare de conexiune, încearcă din nou”, nu „Bilet negăsit”.

## Detalii tehnice
- Migrare: SECURITY DEFINER, `search_path=public`, grant doar către `authenticated`. Folosește indexurile existente pe `tickets.qr_code_data`. Se adaugă unul dacă lipsește, la fel pentru `public_tickets.qr_code_data`.
- Statusul automat se calculează pe server, în fusul orar Europe/Bucharest, cu aceeași regulă ca `determineAutoStatus`.
- Fișiere: `ProfScanPage.tsx`, `coordinator/ScanPage.tsx`, `AdminScanPage.tsx`, `StudentScanPage.tsx`.
- În `AGENTS.md` adăugăm regula: scanarea biletelor trece doar prin `scan_event_ticket`.
- Aplicațiile mobile primesc reparația după publicarea web. Dacă aplicația încarcă build-ul local, este nevoie de o versiune nouă în magazine.
