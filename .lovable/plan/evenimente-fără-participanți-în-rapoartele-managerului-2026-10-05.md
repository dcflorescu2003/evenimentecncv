# Evenimente fără participanți în rapoartele managerului

## Raport pe clase
- Pentru fiecare clasă, după evenimentele cu elevi înscriși, apar la sfârșitul tabelului evenimentele destinate clasei care au 0 elevi înscriși din ea.
- „Destinat clasei" = evenimentul are clasa în lista de clase eligibile sau anul clasei în lista de ani eligibili (doar evenimente interne, fără ciorne și anulate).
- Aceste rânduri au fundal portocaliu deschis și eticheta „0 înscriși". Mesajul „0 evenimente" apare doar dacă nu există niciun eveniment destinat clasei.
- În PDF apar și ele, după celelalte, cu „0 elevi".

## Raport pe profesori
- Listă: coloană nouă „Planificate fără participanți" — numărul evenimentelor coordonate în sesiune, nedesfășurate încă, cu 0 participanți; afișat cu portocaliu când e mai mare ca 0 (și pe mobil, ca text portocaliu).
- Detaliu profesor: evenimentele cu 0 participanți au rândul marcat cu portocaliu și eticheta „Fără participanți".
- Orele de normă rămân calculate doar din evenimentele desfășurate, ca acum.
- Inclus în ambele exporturi PDF.

## Detalii tehnice
- `ClassReportPage.tsx`: interogarea evenimentelor include `eligible_classes, eligible_grades, is_public, status`; pentru fiecare clasă se adaugă evenimentele potrivite (după id/nume clasă și `grade_number`) fără înscrieri, sortate după dată, cu `studentCount: 0` și flag `noParticipants`.
- `TeacherReportPage.tsx`: în sumar se numără rezervările active pe eveniment (deja preluate) și se calculează `plannedEmpty` per profesor (status ≠ draft/cancelled, 0 participanți, nedesfășurat). În detaliu, clasă de rând portocalie pentru `participants === 0`.
- Culoarea portocalie printr-un token semantic (ex. `--warning`) în `index.css`/tailwind, nu culori hardcodate.
- Fără modificări în baza de date.
