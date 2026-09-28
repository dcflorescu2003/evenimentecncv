# Date demo pentru sesiunea „Demo Cantemir”

Sesiunea este activă și ține de luni 05.10.2026 până vineri 09.10.2026.

## Ce creez
- **15 evenimente**, câte 3 pe zi (luni–vineri), fiecare cu alt titlu realist (conferință, atelier, vizită la muzeu, concurs, film și dezbatere etc.), la ore diferite între 08:00 și 18:00 (format 24h), în locuri diferite, cu 20–30 de locuri fiecare.
- **Organizator:** Cosmin Florescu. **Coordonator:** tot Cosmin Florescu, la toate cele 15.
- **Vizibilitate:** fără clase selectate, deci ascunse elevilor. Le văd doar elevii înscriși.
- **Înscrieri:** între 5 și 10 elevi aleși la întâmplare din toată școala, la fiecare eveniment. Fiecare primește bilet cu cod QR. Un elev nu ajunge la două evenimente care se suprapun.
- **Fără notificări** către elevi (nici în aplicație, nici push).

## Verificare
- Număr evenimente, coordonatori și bilete per eveniment (5–10).
- Paginile evenimentelor se deschid corect din contul tău.

## Ștergere ulterioară
Când termini demo-urile, îmi spui și șterg tot ce ține de sesiune: evenimente, rezervări, bilete, coordonatori și sesiunea însăși.

## Detalii tehnice
- Inserare directă prin SQL (fără RPC `manually_enroll_event_student`, ca să nu se genereze notificări): `events` (session_id Demo Cantemir, status published, published=true, is_public=false, fără clase/ani eligibili, created_by = 8d8a86be-…), `coordinator_assignments`, `reservations` + `tickets` (QR unic, status reserved).
- Elevi aleși aleatoriu din profiles cu rol `student`, excluzând suprapunerile orare din aceeași zi.
- Toate rândurile se pot identifica după session_id pentru ștergerea finală.
