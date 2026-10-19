# Bilete lipsă la înscrieri

## Ce am găsit
- La „Atelier matematic” (19.10, 08:00) sunt 23 de înscrieri, dar 2 elevi nu au bilet (ex. Robert-Mihai Satori). Același lucru la „Atelier matematic” din 20.10 (2 elevi).
- În toată școala sunt **61 de înscrieri fără bilet**, din ultimele săptămâni.
- Cauza: înscrierea se face în doi pași din aplicație — întâi rezervarea, apoi biletul. Când al doilea pas eșuează (de ex. serverul e încărcat și apare „timeout”), rezervarea rămâne, dar biletul nu se mai creează. Elevul apare „Rezervat”, dar fără cod QR.

## Ce reparăm
1. **Creăm acum biletele lipsă** pentru toate cele 61 de înscrieri active (cod QR nou, status „rezervat”), fără notificări.
2. **Biletul se creează automat de server** în același moment cu rezervarea (și la reactivarea unei rezervări anulate). Nu mai poate exista rezervare fără bilet.
3. Aplicația nu mai încearcă să creeze biletul separat (elev, profesor, coordonator), ca să nu apară dubluri sau erori.

## Verificare
- Numărul de înscrieri active fără bilet = 0.
- Robert-Mihai Satori are bilet la Atelier matematic.

## Detalii tehnice
- Migrare: funcție + trigger `AFTER INSERT OR UPDATE OF status ON reservations` care face `INSERT INTO tickets (reservation_id) ... ON CONFLICT (reservation_id) DO NOTHING` când `status='reserved'`; SECURITY DEFINER, `search_path` fixat.
- Backfill o singură dată pentru rezervările `reserved` fără ticket.
- Frontend: `StudentEventDetailPage.tsx`, `ProfEventParticipantsPage.tsx`, `coordinator/EventParticipantsPage.tsx` — se elimină `tickets.insert`, se citește biletul creat de server.
- Telefoanele au nevoie de versiune nouă doar pentru pasul 3; pașii 1–2 funcționează imediat pentru toți.
