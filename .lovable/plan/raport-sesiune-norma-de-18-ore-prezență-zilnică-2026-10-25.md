# Raport sesiune: norma de 18 ore = prezență zilnică

## Regula nouă
- Clasele cu normă de 18 ore (V–VIII, XII): dacă elevul a fost prezent în fiecare zi lucrătoare a sesiunii (cel puțin o oră), are 0 absențe pe fiecare zi și la „Total”, oricâte ore are în total.
- Dacă lipsește complet într-o zi, absențele se calculează ca înainte (4 minus orele realizate, pe fiecare zi).
- Clasele cu normă de 20 de ore rămân neschimbate.
- La fel în tabel, PDF și CSV.

## Verificare
- Teste: 5, 2, 4, 3, 7 ore → 0 absențe; 4, 4, 4, 4, 0 → 4 absențe; aceeași serie la normă de 20 → absențe normale.
- Verific raportul pentru XII A și XII C pe „Săptămâna verde”.

## Detalii tehnice
- `computeDailyAbsences` în `src/lib/student-hours.ts`: la normă redusă (`requiredTotal < zile × 4`), se renunță la condiția `total >= requiredTotal`; rămân doar „toate zilele încheiate” și „prezent în fiecare zi”.
- Actualizare `src/test/student-absences.test.ts` (cazul de 17 ore devine 0).
- Cheia de cache a raportului include normele, ca să nu rămână valori vechi.
