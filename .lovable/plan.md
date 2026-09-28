# Evenimente coordonate și norma de ore la profesori și diriginți

## Ce se schimbă

1. **„Evenimentele mele"**: lista va conține și evenimentele la care profesorul a fost adăugat coordonator, nu doar pe cele create de el.
   - Evenimentele coordonate apar cu eticheta „Coordonator".
   - Profesorul poate deschide participanții și scanarea, dar nu poate edita sau șterge evenimentul, dacă nu l-a creat el. Drepturile rămân cele de acum.
2. **Cartonaș „Norma"** pe sesiunea selectată, afișat în „Evenimentele mele" și în Dashboard:
   - arată `X h / norma h`, unde X reprezintă orele evenimentelor coordonate din acea sesiune, cu o bară de progres;
   - numără evenimentele publicate, cele desfășurate și pe cele programate. Afișăm separat „desfășurate" și „programate", ca să se vadă ce s-a realizat deja;
   - apare o listă de alegere a sesiunii (implicit sesiunea activă);
   - dacă profesorul nu are o normă setată, cartonașul arată „Normă nesetată".
3. **Diriginți**: același cartonaș apare în panoul „Clasa mea" și în Dashboard, și pentru diriginții care nu au rolul de profesor.

## Detalii tehnice
- Componentă nouă `NormProgressCard` (sessionId opțional). Citește `profiles.teaching_norm` și `coordinator_assignments` → `events` (session_id, status ≠ draft/cancelled, counted_duration_hours).
- `ProfEventsPage`: se reunesc evenimentele create și cele din `coordinator_assignments`, fără duplicate, cu un indicator de rol. Acțiunile de editare/ștergere sunt ascunse pentru evenimentele necreate de profesor.
- `ProfDashboard`: calculul actual al normei (care numără doar evenimentele trecute și cere reguli de participare) este înlocuit cu `NormProgressCard`.
- `TeacherDashboard`: se adaugă `NormProgressCard`.
- Fără modificări în baza de date: politicile actuale permit deja coordonatorilor să citească evenimentele.
