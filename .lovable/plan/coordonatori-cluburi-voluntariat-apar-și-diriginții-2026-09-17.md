# Coordonatori cluburi/voluntariat: apar și diriginții

## Cauza
- Toți cei 34 de diriginți au în baza de date doar rolul `homeroom_teacher` (nu au și rol `teacher`).
- La cluburi, căutarea de coordonatori (`ClubDetailPage.tsx`, fila Coordonatori) include deja `homeroom_teacher` în filtru, dar regulile de acces (RLS) de pe `user_roles` permit unui utilizator ne-admin (ex. CSE, profesor coordonator) să citească doar rolurile de tip `student` ale altora — deci la căutare nu apare niciun profesor/diriginte pentru ei, iar comportamentul diferă de la cont la cont.
- La proiectele de voluntariat nu există deloc o filă de Coordonatori în interfață, deși tabelul `volunteer_coordinators` și funcția `is_volunteer_coordinator` există deja în baza de date.

## Ce se schimbă pentru utilizatori
- La cluburi, în fila „Coordonatori", căutarea returnează toți profesorii, inclusiv diriginții (care sunt și profesori), indiferent dacă cine caută este admin, CSE sau profesor coordonator.
- La proiectele de voluntariat apare o filă nouă „Coordonatori": creatorul proiectului, adminul sau CSE poate căuta și adăuga profesori/diriginți ca coordonatori, sau îi poate elimina.
- Coordonatorii adăugați la un proiect de voluntariat primesc aceleași drepturi de gestionare ca creatorul (membri, zile, prezență, scanare QR), prin funcția `is_volunteer_coordinator` deja existentă.

## Detalii tehnice
1. Migrare: politică nouă `SELECT` pe `user_roles` — orice utilizator autentificat poate citi rândurile cu roluri didactice (`teacher`, `homeroom_teacher`, `coordinator_teacher`, `cse`). Acest lucru deblochează căutarea de personal pentru CSE/coordonatori, în același tipar cu politicile existente „read student roles".
2. `ClubDetailPage.tsx` (CoordinatorsTab): fără modificare de filtru (include deja `homeroom_teacher`); funcționează corect pentru toți după pasul 1.
3. `VolunteerProjectDetailPage.tsx`:
   - filă nouă „Coordonatori" (vizibilă pentru creator/admin/CSE), cu aceeași căutare Combobox ca la cluburi, filtrând rolurile `teacher`, `homeroom_teacher`, `coordinator_teacher`, `cse`;
   - insert/delete în `volunteer_coordinators` (RLS existent permite deja creatorului/adminului);
   - `canEdit` extins: utilizatorul este considerat manager al proiectului și dacă apare în `volunteer_coordinators` pentru proiectul respectiv (query suplimentar), ca să poată folosi efectiv filele de gestionare.
4. Verificare: build + test în preview căutând un diriginte cunoscut, atât la club, cât și la proiect de voluntariat.
