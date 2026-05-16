# Problem

În "Normă incompletă" → tab Profesori, toți profesorii apar cu 0 evenimente și 0h organizate (inclusiv Florescu Cosmin, care în raportul pe profesori are 34h / 20h normă completă).

# Cauza

`src/pages/manager/IncompleteNormPage.tsx` (query `mgr-incomplete-teachers`) suferă de aceeași problemă rezolvată deja în `TeacherReportPage.tsx`:

1. `supabase.from("reservations").in("event_id", sessionEventIds)` — la nivel de sesiune întreagă `sessionEventIds` poate avea sute de UUID-uri → URL PostgREST trunchiat.
2. Răspunsul de la `reservations` și `tickets` e plafonat la 1000 rânduri → la o sesiune cu mii de rezervări totale (cazul real), tichetele lipsesc complet → `ticketsByEvent` rămâne gol → `getHeldEventIds` întoarce set vid → toți profesorii apar cu 0h → toți apar în "normă incompletă", inclusiv Florescu.
3. În plus, `public_tickets` nu sunt deloc considerați la held-detection, deci evenimente publice (ex. Ziua Porților) nu ar fi numărate chiar dacă tichetele interne ar funcționa.

# Soluție

În `IncompleteNormPage.tsx`, query-ul `mgr-incomplete-teachers`:

1. Extrag helper-ul `fetchInChunks(ids, chunkSize, fetcher)` (cel deja folosit în `TeacherReportPage`) într-un fișier comun `src/lib/supabase-chunk.ts` și îl import în ambele pagini, ca să evit duplicarea.
2. Înlocuiesc fetch-urile pentru `reservations` și `tickets` cu `fetchInChunks` (chunk 200 ID-uri, paginație `.range()` per chunk de 1000 rânduri).
3. Adaug fetch-uri analoage pentru `public_reservations` și `public_tickets`, agregându-le în `ticketsByEvent` ca în `TeacherReportPage`.

Restul logicii (filtrarea profesorilor cu `teaching_norm`, calculul orelor pe baza evenimentelor desfășurate, sortarea) rămâne neschimbată.

# Verificare

După fix:
- Florescu Cosmin nu mai apare în lista "Normă incompletă" (are 34h ≥ 20h).
- Profesorii care chiar au sub normă rămân, cu numărul real de evenimente desfășurate și ore organizate.
- Confirm vizual pe `/manager/incomplete` în preview.

# Fișiere modificate

- `src/lib/supabase-chunk.ts` (nou — helper extras)
- `src/pages/manager/TeacherReportPage.tsx` (înlocuiește helper-ul local cu importul)
- `src/pages/manager/IncompleteNormPage.tsx` (chunking + public tickets)
