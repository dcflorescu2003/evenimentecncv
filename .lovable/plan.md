## Obiectiv

Permite afișarea numelui complet al profesorului în orar atunci când inițialele din XML coincid cu inițialele unui profesor înregistrat. La coliziuni (2+ profesori cu aceleași inițiale) se păstrează inițialele și le ajustezi manual.

## Modificări

### 1. Bază de date

Migrație: adaug coloana `initials text` (nullable, max 8 caractere) pe `profiles`. Index parțial pentru lookup rapid pe inițiale ne-nule.

### 2. Edge function `admin-manage-users`

- `create_user` și `update_user`: accept un câmp opțional `initials` (string sau null) care se salvează în `profiles.initials`.

### 3. UI Admin Utilizatori (`src/pages/admin/UsersPage.tsx`)

- În dialogurile de creare/editare utilizator: câmp text "Inițiale" vizibil pentru rolurile `teacher`, `coordinator_teacher`, `homeroom_teacher`.
- Afișare inițialelor în tabelul de profesori (coloană nouă sau lângă nume).

### 4. Rezolvare nume profesor la afișare orar

- Helper nou `src/lib/teacher-initials.ts` cu funcția `resolveTeacherDisplay(initials, teacherMap)`:
  - construiește un `Map<string, string[]>` (inițiale → listă nume complete)
  - dacă există exact 1 match → întoarce numele complet ("Nume Prenume")
  - dacă 0 sau ≥2 match-uri → întoarce inițialele neschimbate
- În `StudentSchedulePage.tsx` și oriunde se afișează orarul: încarc `profiles` cu `initials` ne-nule + roluri profesor, construiesc map-ul, înlocuiesc `teacher_name` la randare (fără a modifica datele salvate în DB).

### 5. Editor grilă (`ScheduleGridEditor.tsx`)

- Câmpul rămâne `teacher_name` (text liber, conține inițialele importate). Nu schimb logica de import.
- Sub câmp: badge mic care arată numele rezolvat dacă există match unic, sau "Inițiale duplicate" la coliziune (doar indicativ pentru admin).

## Ce NU se schimbă

- Importul XML continuă să salveze inițialele ca text în `teacher_name`.
- Nu se face matching la import (rezolvare strict la afișare) — astfel dacă adaugi inițiale ulterior, numele apar automat fără reimport.
- Datele existente rămân valabile.

## Întrebare rapidă

Câmpul "Inițiale" îl vrei doar pentru profesori (teacher/coordinator_teacher/homeroom_teacher) sau și pentru admin/manager? Plan curent: doar profesori.  
Doar profesori