# Raport sesiune: norma de 18 ore (clasele V–VIII)

## Regula
- Clasele cu normă de 18 ore în sesiune (acum V, VI, VII, VIII): dacă elevul are prezență în fiecare zi lucrătoare a sesiunii și cel puțin 18 ore realizate în total, are 0 absențe, atât pe fiecare zi, cât și la „Total”.
- Altfel, absențele se calculează ca acum: 4 ore minus orele realizate, pentru fiecare zi.
- Norma se ia din regulile de participare ale clasei pentru sesiunea aleasă. Clasele cu normă de 20 de ore rămân neschimbate.
- Se aplică la fel în tabel, PDF și CSV.

## Verificare
Test unitar pentru regulă: un elev cu ore 4, 4, 4, 3, 3 (18 ore) are 0 absențe; cu 4, 4, 4, 4, 0 are 4; cu ore 4, 4, 3, 3, 3 (17 ore) are 3. Apoi verific raportul pentru clasa V.

## Detalii tehnice
- `student-hours.ts`: `computeDailyAbsences` primește opțional `requiredTotal`; dacă toate zilele încheiate au mai mult de 0 ore și suma plafonată este cel puțin `requiredTotal`, întoarce 0 pe fiecare zi și 0 la total. Se aplică doar când `requiredTotal` este sub 5 × 4 și toate zilele sesiunii sunt încheiate.
- `SessionAbsenceReportPage.tsx`: citește `class_participation_rules` (`requirement_type = hours`) pentru sesiune; `absentFor` folosește valorile per zi calculate, nu `4 - perDay`.
- Test nou în `src/test/student-absences.test.ts`.
