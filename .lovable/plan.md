# Smart Lab — afișarea numelui celui care a rezervat

## Problema
În calendarul Smart Lab și în fereastra de detalii apare „—” la Profesor. Regulile de acces la date permit unui profesor să vadă doar numele altor profesori, nu și pe cele ale diriginților, CSE sau managerilor. Elevii voluntari nu văd deloc numele profesorilor.

## Ce se schimbă
- Toți cei care au acces la Smart Lab (profesori, diriginți, CSE, manageri, admin, elevi voluntari) văd „Nume Prenume” pentru cine a făcut fiecare rezervare, atât în calendar, cât și în detalii.
- Se afișează doar numele (fără email sau alte date) și numai pentru persoanele care au rezervări în Smart Lab.

## Detalii tehnice
- Funcție nouă în baza de date `get_vr_reservation_teacher_names(_ids uuid[])` (security definer). Returnează `id, first_name, last_name` doar pentru id-urile care apar ca `teacher_id` în `vr_reservations`. Execuția e permisă doar utilizatorilor autentificați.
- `SmartLabPage.tsx`: interogarea `vr-teacher-names` folosește noua funcție în locul citirii directe din `profiles`.
- Regulile de acces pe `profiles` rămân neschimbate.
