# Coordonatori și asistenți la cluburi și voluntariat

## Ce se schimbă pentru utilizatori

### Coordonatori (cluburi + voluntariat)
- Pot fi adăugați oricâți profesori și diriginți.
- Pot fi adăugați maxim 2 elevi coordonatori. La al treilea elev apare mesajul: „Poți avea maxim 2 elevi coordonatori.”
- Elevii coordonatori apar în listă cu o etichetă distinctă „Elev”, iar profesorii/diriginții cu „Profesor”.
- Coordonatorii (inclusiv cei elevi) sunt practic administratorii clubului/proiectului: descriere și setări generale, formular de înscriere, cereri de înscriere (aprobă/respinge), membri, departamente, întâlniri/zile și prezență.
- Elevii coordonatori pot adăuga și șterge alți coordonatori și asistenți elevi.

### Asistenți
- Rămân elevi cu drepturi limitate: văd lista membrilor (fără a o modifica) și marchează prezența la întâlniri/zile (manual sau prin scanare QR).
- Nu mai au acces la descriere/setări, formular, cereri, departamente sau la crearea/ștergerea întâlnirilor.
- La proiectele de voluntariat apare o filă nouă „Asistenți”, cu același comportament ca la cluburi.

## Detalii tehnice

1. **Migrare bază de date**
   - Tabel nou `volunteer_student_assistants` (project_id, student_id, assigned_by, unic pe pereche) + GRANT-uri, RLS și funcția `security definer` `is_volunteer_student_assistant(_user_id, _project_id)`, după modelul `club_student_assistants` / `is_club_student_assistant`.
   - Politici RLS pentru asistenții de voluntariat: citire `volunteer_enrollments` și `volunteer_days`, inserare/actualizare `volunteer_attendance` pentru proiectul lor. Fără drept de modificare a proiectului.
   - Trigger de validare pe `club_coordinators` și `volunteer_coordinators`: respinge inserarea unui al treilea coordonator care are rol `student`, cu mesaj explicit în română.
   - Politici pentru coordonatorii elevi: `club_coordinators`, `club_student_assistants`, `volunteer_coordinators`, `volunteer_student_assistants` permit insert/delete și utilizatorilor care sunt deja coordonatori ai clubului/proiectului (prin `is_club_coordinator` / `is_volunteer_coordinator`), nu doar creator/admin/CSE.

2. **`ClubDetailPage.tsx`**
   - Se separă `canManage` (coordonator/creator/admin — drepturi complete) de `isAssistant`.
   - Asistentul nu mai intră în `canManage`; primește un nou set de drepturi: vede filele „Membri” (doar citire) și „Întâlniri” cu prezență editabilă, fără creare/ștergere de întâlniri.
   - `canManageCoords` include și coordonatorii (inclusiv elevi).
   - `CoordinatorsTab`: încarcă rolurile coordonatorilor existenți, afișează badge „Elev”/„Profesor”, numără elevii și blochează adăugarea peste 2 cu mesaj clar; rezultatele căutării marchează elevii.

3. **`VolunteerProjectDetailPage.tsx`**
   - Aceeași logică de coordonatori (badge-uri + limita de 2 elevi) în `CoordinatorsTab`.
   - Filă nouă „Asistenți” (vizibilă coordonatorilor/creatorului/adminului), cu căutare de elevi și adăugare/eliminare în `volunteer_student_assistants`.
   - Asistentul de proiect primește acces la fila „Înscriși” (doar citire) și la „Zile & prezență” cu marcare de prezență, fără editarea proiectului sau a zilelor.

4. **`ClubManagementTabs.tsx` / tab-urile de zile și membri**
   - Prop nou `readOnly` pentru lista de membri/înscriși, folosit pentru asistenți.
   - `MeetingsTab` / `DaysTab`: modul „doar prezență” (fără formularul de creare și fără butoanele de ștergere).

5. **Verificare**: build + typecheck; test în preview cu un club real — adăugare a 2 elevi coordonatori și verificarea refuzului la al treilea.
