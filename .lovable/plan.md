## Context

Cele 2 evenimente (28.04 vs Tudor Vianu și 29.04 vs Dimitrie Bolintianu) au deja `max_per_class = 5` setat în baza de date. Funcția RPC `check_booking_eligibility` aplică deja generic această limită la auto-rezervările elevilor (exclude asistenții). Deci regula este deja activă pentru viitor — un elev care încearcă să rezerve va primi: *„Limita pentru clasa ta a fost atinsă (5 locuri per clasă)”*.

Totuși, există rezervări istorice făcute înainte de setarea limitei care depășesc 5/clasă. Acestea trebuie anulate (păstrând primii 5 după `created_at`).

## Rezervări care vor fi anulate

**Meci 28.04 (vs Tudor Vianu)** — 12 rezervări de anulat:
- IX B (2): RAREȘ VÂLCU, EDUARD-MIHAI VÂLCU
- IX F (1): ANDREI-LUCA STĂMESCU
- X A (5): IOAN-VLAD CIUREA, CONSTANTIN MORMENSCHI, ALESSIA-MARIA ILIE, DAVID-ȘTEFAN CALISPERA, CĂLIN-GEORGE MĂNĂILĂ
- X E (4): TOMA ANDREI PRAȚA, MARIA FRUNTELATĂ, ŞTEFANIA-DENISA BORDEA, LAVINIA IVAN

**Meci 29.04 (vs Dimitrie Bolintianu)** — 13 rezervări de anulat:
- IX B (2): RAREȘ VÂLCU, EDUARD-MIHAI VÂLCU
- IX F (1): PATRICIA-SOFIA NIȚĂ
- X A (5): CEZAR ROTARU, IOAN-VLAD CIUREA, ALESSIA-MARIA ILIE, DAVID-ȘTEFAN CALISPERA, CĂLIN-GEORGE MĂNĂILĂ
- X E (4): ION-MIRCEA DIMITRIU, TOMA ANDREI PRAȚA, MARIA FRUNTELATĂ, LAVINIA IVAN
- X G (1): SOFIA-ELENA ȘTEFAN

Total: **25 rezervări** vor primi `status='cancelled'` și `cancelled_at=now()`. Asistenții sunt deja excluși din numărătoare.

## Acțiuni

1. **UPDATE** pe `reservations` — anulez exact cele 25 ID-uri identificate mai sus (anularea include automat și ștergerea ticket-urilor asociate dacă există, prin logica existentă).
2. **Verificare regulă viitoare**: confirm că `max_per_class=5` este setat pe ambele evenimente și că `check_booking_eligibility` o aplică (deja confirmat — vezi codul funcției). Nu sunt necesare modificări de cod.
3. **Generare PDF actualizat** cu lista finală de participanți pe fiecare meci, după aplicarea regulii.

## Note

- Diriginții/admin-ii pot încă adăuga manual peste limită (cerință existentă) — doar auto-rezervarea elevilor este blocată.
- Nu modific schema sau funcția RPC — totul funcționează deja generic.
