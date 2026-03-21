

## Plan: Camp "Norma" pentru Profesori

### Ce se schimba

Se adauga un camp numeric `teaching_norm` pe profilul profesorului care reprezinta orele minime de organizare. In sesiunile cu reguli de participare, profesorii trebuie sa organizeze cel putin atatea ore cat norma lor.

### 1. Migrare baza de date

Adaug coloana `teaching_norm` (integer, nullable, default null) pe tabela `profiles`. Cand e null/0 = fara norma.

### 2. Formularul de creare utilizator (Admin)

**`src/pages/admin/UsersPage.tsx`**
- In dialogul "Utilizator nou", cand rolul selectat e `teacher` sau `homeroom_teacher`, apare un camp numeric "Norma (ore)" optional
- Campul se trimite catre edge function `admin-manage-users` care il salveaza in `profiles.teaching_norm`
- In tabelul de utilizatori, afisez norma langa roluri pentru profesori (ex: "Profesor · 12h")

**`supabase/functions/admin-manage-users/index.ts`**
- La `create_user`, accept parametrul `teaching_norm` si il inserez in profil

### 3. Editarea normei (Admin)

- Adaug posibilitatea de a edita norma unui profesor existent din tabelul de utilizatori (click pe valoare sau buton edit) — update direct pe `profiles.teaching_norm`

### 4. Dashboard profesor

**`src/pages/prof/ProfDashboard.tsx`**
- Verific daca exista sesiuni active cu `class_participation_rules`
- Daca da si profesorul are `teaching_norm > 0`, afisez un card "Norma: X ore organizate / Y ore norma" cu progress bar
- Orele organizate = sum(counted_duration_hours) din evenimentele din sesiunea activa unde profesorul e coordinator

### 5. Rapoartele Manager

**`src/pages/manager/TeacherReportPage.tsx`**
- In tabelul cu profesori, adaug coloana "Norma" care arata teaching_norm
- Afisez "Ore organizate / Norma" per sesiune

**`src/pages/manager/IncompleteNormPage.tsx`**
- Tab "Profesori": filtrez dupa `teaching_norm` al profesorului (nu dupa totalul sesiunii)
- Un profesor are norma incompleta daca ore_organizate < teaching_norm
- Afisez: Profesor, Norma, Ore organizate, Ore ramase

### Fisiere afectate

| Tip | Fisier |
|-----|--------|
| Migrare | SQL: adauga `teaching_norm` pe `profiles` |
| Edge fn | `admin-manage-users/index.ts` — accept `teaching_norm` la create |
| Editat | `UsersPage.tsx` — camp norma in dialog + editare + afisare |
| Editat | `ProfDashboard.tsx` — card norma per sesiune activa |
| Editat | `TeacherReportPage.tsx` — coloana norma in tabel |
| Editat | `IncompleteNormPage.tsx` — filtru dupa teaching_norm |

