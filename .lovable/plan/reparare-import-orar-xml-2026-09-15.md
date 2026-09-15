# Reparare import orar XML

## Problema

Am verificat fișierul trimis: fiecare zi are exact 12 celule de oră (Ora 1 … Ora 12), fără nicio coloană suplimentară.

Importul actual presupune că a doua celulă din fiecare rând este o „coloană fantomă" rămasă dintr-un export PDF vechi și o aruncă întotdeauna. De aceea, la clasa a V-a:

- ora a 2-a din fișier (Matematică) dispare complet;
- toate orele următoare se mută cu o poziție mai devreme, deci ordinea din aplicație nu mai corespunde fișierului.

Asta explică și „5 ore în fișier, mai puține în aplicație, în altă ordine".

## Soluția

1. **Eliminarea presupunerii greșite.** Importul va detecta singur structura: numără celulele fiecărei zile și sare peste o coloană suplimentară doar când rândurile chiar au mai mult de 12 celule de oră (formatul vechi). Pentru fișiere ca cel trimis, ora N din fișier devine exact Ora N în aplicație.
2. **Ore împărțite pe grupe.** Celulele de tip „Lf 1 TS / Lf Lb CIS" (două grupe în aceeași oră) vor fi păstrate lizibil: materia primei grupe, iar profesorii ambelor grupe afișați împreună, în loc de textul brut amestecat.
3. **Completare abrevieri.** Adaug la lista de denumiri: Fiz → Fizică, Ch → Chimie, Lg → Limba germană, L.lat → Limba latină, Lch → (grupă) astfel încât orarul afișat să nu mai conțină prescurtări necunoscute.
4. **Verificare.** După modificare, reimport fișierul trimis și confirm că fiecare clasă are exact orele din fișier, în ordinea corectă (clasa a V-a: luni 5 ore, începând cu Religie la Ora 1 și Matematică la Ora 2).

## Detalii tehnice

- `src/lib/import-orar-xml.ts` → `extractClassSchedule`: înlocuiesc `if (idx === 1) return` (skip hardcodat) cu o detecție per tabel a numărului maxim de `<TD>` pe rând; offset-ul fantomă se aplică doar când acel număr depășește 12.
- `parseScheduleCell`: suport pentru separatorul „/" (grupe) — se parsează fiecare segment și se combină profesorii.
- `src/lib/schedule-aliases.ts`: intrări noi pentru abrevierile lipsă.
- Nicio modificare de bază de date; importul existent rămâne compatibil cu fișierele în vechiul format.
