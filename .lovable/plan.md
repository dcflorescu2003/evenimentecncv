# Limită de 4 ore pe zi pentru elevi

## Ce se schimbă
- Un elev nu poate avea mai mult de **4 ore de activități în aceeași zi**, indiferent câte evenimente alege.
- Orele se socotesc la fel ca în rapoarte (durata contabilizată a fiecărui eveniment), adunând toate rezervările active ale elevului din ziua respectivă.
- Dacă un nou eveniment ar depăși 4h, înscrierea este refuzată cu mesajul: „Ai atins limita de 4 ore de activități pe zi (ai deja Xh rezervate pe zz.ll.aaaa)”.
- Limita se aplică peste tot:
  - înscrierea făcută de elev;
  - înscrierea manuală făcută de profesor, coordonator sau diriginte;
  - distribuirea automată a diriginților (propunerea nu mai alocă evenimente care ar depăși 4h pe zi, inclusiv între alocările propuse).
- În lista de evenimente disponibile pentru diriginte nu mai apar evenimentele care ar depăși limita.
- Rezervările existente care depășesc deja 4h nu se anulează.
- Rolul de elev asistent nu se socotește (nu este rezervare).

## Detalii tehnice
- Migrare: în `check_booking_eligibility` și `manually_enroll_event_student` se adaugă verificarea `sum(counted_duration_hours)` pentru rezervările `reserved` ale elevului cu `events.date = _event.date` (fără anulate) + evenimentul nou > 4 → refuz. Limita ca constantă în funcție.
- Frontend: filtrul din dialogul de înscriere al dirigintelui și algoritmul de distribuire automată țin cont de orele pe zi (aceeași regulă).
- Fără update obligatoriu în aplicațiile mobile: verificarea principală e în backend; filtrul din listele diriginților apare pe mobil după un nou build.
