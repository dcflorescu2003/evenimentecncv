# Problem

În "Raport pe profesori" pentru Florescu Cosmin:
- Summary: 13 evenimente desfășurate / 13h (greșit — ar trebui ~20+ evenimente desfășurate)
- Detail: primele 9 evenimente (Marian Tudor, JORGE, Cătălin Oprișan, etc.) apar cu "—" la "Desfășurat", deși au zeci de elevi prezenți (19, 63, 34, 48, 29, 115, 48, 52, 53 prezenți confirmați în DB)
- Doar evenimentele "Ziua Porților deschise" apar marcate ✓

# Cauza reală

Florescu coordonează 23 de evenimente cu ~671 de rezervări interne în total. În `TeacherReportPage.tsx`, atât query-ul de summary cât și cel de detail fac:

```ts
const { data: tickets } = await supabase
  .from("tickets")
  .select("reservation_id, status")
  .in("reservation_id", resIds); // resIds = 671 UUID-uri
```

URL-ul rezultat (`?reservation_id=in.(uuid1,uuid2,...671 uuids)`) depășește limita PostgREST și request-ul fie eșuează silențios, fie întoarce un set gol/trunchiat. De aceea biletele interne nu sunt numărate deloc, și singurele evenimente care apar "desfășurate" sunt cele care au și `public_tickets` (Ziua Porților deschise).

Acest pattern este documentat în memoria proiectului ("UI Query Pattern: 2-step ID chunking for large searchable dataset filters") — trebuie aplicat aici.

# Soluție

În `src/pages/manager/TeacherReportPage.tsx`, în ambele query-uri (`mgr-teacher-summary` și `mgr-teacher-detail`):

1. Adaug un helper local `fetchInChunks(ids, chunkSize=200, fetcher)` care apelează `fetcher(chunk)` în paralel pe bucăți și concatenează rezultatele.
2. Înlocuiesc apelurile `.in("reservation_id", resIds)` pentru `tickets` cu chunking (chunks de ~200).
3. La fel pentru `.in("public_reservation_id", pubResIds)` pentru `public_tickets`.
4. Preventiv, aplic chunking și pentru `reservations` / `public_reservations` când `sessionEventIds` e mare (același risc dacă un profesor are sute de evenimente).

Restul logicii (agregare în `ticketsByEvent` / `countMap`, `getHeldEventIds`, `totalHours`) rămâne neschimbată — output-ul va deveni corect automat odată ce datele sunt complete.

# Verificare

După fix, pentru Florescu Cosmin:
- Toate cele 9 evenimente cu prezență internă (Marian Tudor, JORGE, Meci FC etc.) vor apărea ✓ Desfășurat
- Summary va arăta totalul corect de evenimente și ore (≈ 20 evenimente, ≈ 24h în loc de 13h)
- Detail va include și evenimentele care nu apăreau în screenshot (există 23 în total)

Confirm vizual în preview pe pagina manager → Raport profesori → Florescu Cosmin.

# Fișiere modificate

- `src/pages/manager/TeacherReportPage.tsx` (singurul fișier; nu se ating RLS-uri sau schema)
