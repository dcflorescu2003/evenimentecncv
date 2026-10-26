# Mai puține reîncărcări și ferestre care nu se închid la click în afară

## 1. Mai puține reîncărcări automate
- Datele deja încărcate rămân valabile 1 minut: dacă revii pe o pagină în acest interval, se afișează imediat, fără o nouă cerere.
- Schimbarea tab-ului din browser sau revenirea în aplicație nu mai reîncarcă datele.
- După orice salvare (înscriere, editare, ștergere), listele afectate se actualizează în continuare imediat, ca acum.
- Rămân mereu proaspete, ca acum: scanarea biletelor, notificările, raportul de sesiune și completarea feedback-ului (au deja reguli proprii).

## 2. Ferestrele nu se mai închid la click în afara lor
- Toate ferestrele (eveniment nou, editare, înscriere, diplome etc.) se închid doar din butonul X din colț sau din butoanele „Anulează”/„Închide”.
- Click-ul în afara ferestrei nu mai face nimic, așa că nu pierzi ce ai completat.
- Tasta Esc rămâne funcțională pe calculator (se poate opri și ea, dacă vrei).
- Aceeași regulă și pentru panourile laterale (de ex. meniul pe mobil rămâne la fel, se închide normal).

## Detalii tehnice
- `src/App.tsx`: `new QueryClient({ defaultOptions: { queries: { staleTime: 60_000, refetchOnWindowFocus: false } } })`. Interogările cu `staleTime: 0` / `refetchInterval` explicit își păstrează comportamentul.
- `src/components/ui/dialog.tsx` și `alert-dialog` (deja blocat implicit): în `DialogContent` se adaugă `onInteractOutside={(e) => e.preventDefault()}` (cu posibilitatea de suprascriere prin props). Butonul X existent rămâne; eticheta sr-only devine „Închide”.
- `sheet.tsx` (meniul mobil) nu se modifică.
- Regulă nouă în AGENTS.md despre comportamentul implicit al dialogurilor și cache-ului.
