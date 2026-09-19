# 5 bilete QR de test pentru evenimentul „Test"

## Ce primești

- 5 rezervări reale (status „reserved") la evenimentul **Test** (azi, 08:00–10:00), făcute pe numele a 5 elevi existenți.
- Câte un bilet cu cod QR valid pentru fiecare — exact ce vede un elev în aplicație.
- O foaie PDF cu cele 5 coduri QR, etichetate cu numele elevului, pe care o deschizi pe ecran și o scanezi din pagina de scanare.

## Cum funcționează testarea

- Fiecare cod scanat la evenimentul „Test" marchează elevul **Prezent** sau **Întârziat** (după regula automată de orar).
- A doua scanare a aceluiași cod arată mesajul „Biletul a fost deja procesat" — deci poți testa și cazul de duplicat.
- Codurile scanate la alt eveniment arată „Biletul nu aparține acestui eveniment".

## Detalii tehnice

1. **Alegerea elevilor**: 5 elevi existenți (rol `student`), fără rezervare la acest eveniment (constrângerea `UNIQUE(student_id, event_id)` impune elevi distincți).
2. **Inserare SQL** (o singură rulare, fără migrare nouă):
   - `reservations`: `reservation_code` unic (format `TEST-XXXXX`), `status = 'reserved'`.
   - `tickets`: `qr_code_data = gen_random_uuid()::text`, `status = 'reserved'` — identic cu fluxul real de rezervare (care folosește `crypto.randomUUID()`).
   - Inserarea directă ocolește intenționat `check_booking_eligibility` (e doar pentru test).
3. **Foaia cu QR-uri**: script local care generează cele 5 imagini QR (conținut = valoarea `qr_code_data`) într-un PDF salvat în Fișiere (`/mnt/documents`), cu numele elevului sub fiecare cod.
4. Fără modificări de cod în aplicație, fără migrări, fără tabele noi.

## Curățare (opțional, la cerere)

După test, cele 5 rezervări pot fi șterse sau anulate cu o singură comandă.
