# Distribuirea corectă a evenimentelor pe clase în rapoarte

## Ce am găsit
- „Igienizarea clasei" are bifată clasa XII A, dar are salvat și anul „XII" în lista de ani eligibili.
- Regula din aplicație (cine vede evenimentul) este: **dacă sunt bifate clase, contează doar clasele**; anul contează doar când nu e bifată nicio clasă. Deci elevii celorlalte clase a XII-a NU văd evenimentul — partea de securitate e corectă.
- „Raport pe clase" din contul de manager folosea însă „clasă SAU an", de aceea evenimentul apărea (cu 0 înscriși) la toate clasele a XII-a.
- Aceeași combinație (clase + an) există la 25 de evenimente active, deci problema apare și la alte clase.

## Ce schimb
1. **Raport pe clase (manager):** un eveniment apare ca „destinat clasei" după aceeași regulă ca vizibilitatea pentru elevi: clase bifate au prioritate; anul doar când nu e bifată nicio clasă. Așa „Igienizarea clasei" va apărea doar la XII A.
2. **Verific toate celelalte locuri** care decid „eveniment destinat unei clase" (raportul diriginților, înscrierea și distribuirea automată de către diriginte, verificarea la rezervarea elevului, rapoartele din admin) și le aliniez la aceeași regulă dacă diferă.
3. După modificare, rulez o verificare pe toate cele 25 de evenimente: fiecare trebuie să apară doar la clasele care îl pot vedea efectiv.

Datele salvate ale evenimentelor nu se schimbă.

## Detalii tehnice
- Sursa de adevăr: `can_view_internal_event` (eligible_classes nevid ⇒ doar clase; altfel eligible_grades).
- `ClassReportPage.tsx`: filtrul `emptyEvents` devine `classes.length>0 ? classes.includes(c.id) : grades.includes(grade)`.
- Audit cu `rg` pentru `eligible_grades` în `src/` și în funcțiile SQL (`list_enrollable_events_for_student`, `check_booking_eligibility`, `homeroom_can_enroll`); orice funcție SQL cu logică „SAU" se corectează printr-o migrare.
