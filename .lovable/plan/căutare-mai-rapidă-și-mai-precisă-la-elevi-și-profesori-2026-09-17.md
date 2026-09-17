# Căutare mai rapidă și mai precisă la elevi și profesori

## Ce am verificat

- Baza de date răspunde în ~2 ms la o căutare de nume (991 de persoane). Deci întârzierea nu vine de la server.
- Căutarea pornește la fiecare literă tastată, fără pauză, deci se trimit multe cereri inutile care se suprapun.
- Fiecare căutare face două cereri una după alta: întâi persoanele, apoi rolurile lor. Se așteaptă dublu.
- Filtrarea pe rol (elev / profesor) se face abia după ce s-au luat primele 20 de rezultate, așa că lista poate apărea aproape goală chiar dacă există persoane potrivite.
- Nu se ignoră diacriticele: „Andries" nu găsește „Andrieș"; „Stefan" nu găsește „Ștefan".
- Nu se poate căuta după nume complet („Popescu Maria" nu returnează nimic, pentru că se caută separat în prenume și în nume).
- Pe pagina de utilizatori din admin se încarcă toată lista și se filtrează în browser, tot fără a ignora diacriticele.

## Ce propun

1. **O singură căutare pe server, care face tot**
   - O funcție nouă de căutare în baza de date care primește textul căutat, rolurile dorite (elevi, profesori, ambele) și numărul maxim de rezultate.
   - Ignoră diacriticele în ambele sensuri și nu ține cont de majuscule.
   - Caută și în „Nume Prenume" scris împreună, și în numele de utilizator.
   - Aplică filtrul de rol înainte de limitare, deci cele 20 de rezultate sunt toate relevante.
   - Ordonează rezultatele: potriviri de la începutul numelui primele, apoi restul, alfabetic românesc.

2. **Indexuri pentru căutare** pe nume, prenume și nume de utilizator, ca să rămână rapidă și când lista crește.

3. **Pauză scurtă la tastare (debounce ~250 ms)** și păstrarea rezultatelor anterioare pe ecran cât timp se încarcă următoarele, ca lista să nu mai clipească.

4. **Aplicare peste tot unde se caută persoane**: coordonatori și membri la cluburi, coordonatori/membri/asistenți la voluntariat, voluntari Smart Lab, rapoarte manager (elev și profesor), listele de elevi din portofoliu, pagina de utilizatori din admin.

## Detalii tehnice

- Migrație: activare `unaccent` și `pg_trgm`; funcție imutabilă `public.f_unaccent(text)`; indexuri GIN trigram pe `lower(f_unaccent(last_name))`, `first_name`, `username` și pe expresia nume complet.
- Funcție `public.search_profiles(_term text, _roles app_role[] default null, _limit int default 20)` — `security definer`, `stable`, `search_path = public, extensions`; join intern cu `user_roles`; returnează `id, first_name, last_name, username, roles text[]`; `EXECUTE` doar pentru `authenticated`. Nu expune `email`.
- Client: hook `useDebouncedValue` în `src/hooks/`; înlocuirea perechilor `profiles.or(ilike…)` + `user_roles` cu `supabase.rpc("search_profiles", …)` în `ClubDetailPage.tsx`, `ClubManagementTabs.tsx`, `VolunteerProjectDetailPage.tsx`, `VrVolunteersPage.tsx`, `StudentReportPage.tsx`, `TeacherReportPage.tsx`; `placeholderData: keepPreviousData` pe aceste interogări.
- `UsersPage.tsx` și `PortfolioStudentListPage.tsx` păstrează listele deja încărcate, dar filtrarea locală trece printr-un helper de normalizare a diacriticelor (`normalize("NFD")`), plus debounce pe câmpul de căutare.
- Fără modificări de reguli de acces existente; funcția respectă vizibilitatea actuală a profilurilor.
