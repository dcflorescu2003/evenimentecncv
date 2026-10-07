# Calendarul păstrează perioada selectată după „Înapoi”

## Ce se schimbă
Când un elev, profesor sau diriginte navighează în „Calendar evenimente” (ex. 2 săptămâni înainte), deschide un eveniment și apasă „Înapoi”, calendarul revine exact la aceeași perioadă și același mod de afișare (zi / săptămână / lună), nu la săptămâna curentă.

Butonul „Azi” rămâne modul de a reveni la săptămâna curentă. Perioada se păstrează doar pe durata sesiunii din browser/aplicație (la închiderea aplicației, calendarul pornește din nou de la azi).

## Detalii tehnice
- În `src/components/student/EventsCalendar.tsx`, `view` și `currentDate` se inițializează din `sessionStorage` (cheie per pagină, ex. `cncv_calendar_state:<pathname>`) și se salvează la fiecare schimbare (dată ca `YYYY-MM-DD`, fără conversii UTC).
- Se aplică automat în toate locurile care folosesc calendarul: dashboard elev, profesor, diriginte și secțiunea „Toate evenimentele”.
- Doar modificare de interfață; fără schimbări în baza de date. Necesită versiune nouă pentru aplicațiile de telefon.
