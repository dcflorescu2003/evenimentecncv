## 1. Buton „Module" în bara de navigare (profesori + diriginți)

În `ProfLayout.tsx` și `TeacherLayout.tsx`, adaug un buton dedicat „Module" în bara de tab-uri (sub header), care folosește `ModuleSwitcher` (varianta labeled). Iconul rămâne și în header, dar va apărea și ca tab vizibil în nav.

## 2. Unificarea barei de navigare în `ProfLayout`

Bara de nav actuală variază în funcție de pagina curentă (`isClubs` / `isFeedback`). O simplific la o listă unică, mereu aceeași:
- Dashboard → `/prof`
- Evenimentele mele → `/prof/events`
- Cluburi & Voluntariat → `/prof/clubs`
- Feedback → `/prof/feedback`
- Clasa mea → `/teacher` (doar diriginte)
- Rapoarte → `/teacher/reports` (doar diriginte)
- Module (selector) — întotdeauna

Același set și în `TeacherLayout.tsx` ca să nu mai existe diferențe între pagini.

## 3. Proiecte de voluntariat în Rapoarte (`TeacherReportsPage`)

Sub-tabul „Situație elevi" și „Verificare prezență" deja includ proiectele de voluntariat. Modific „Sumar" ca să fie aliniat:
- Adaug interogare pe `volunteer_enrollments` + `volunteer_projects` (filtrate pe `session_id`) + `volunteer_days` + `volunteer_attendance` pentru elevii claselor dirigintelui.
- Calculez ore rezervate / validate din voluntariat (zile cu status `present`/`late`, folosind durata zilei din `start_time`/`end_time` rotunjit la oră întreagă, conform regulilor existente) și le însumez cu cele din evenimente în coloanele „Ore rezervate" / „Ore validate".
- Coloana „Rezervări" cumulează numărul de evenimente + zile de voluntariat.
- Exportul PDF rămâne cu aceleași coloane (totalurile sunt deja unificate).

## 4. Vizibilitate restrânsă cluburi/voluntariat pentru non-creatori

Modific `ClubDetailPage.tsx` și `VolunteerProjectDetailPage.tsx`:

**Pentru profesor (`teacher` fără `homeroom_teacher`) care NU este creator/coordonator:**
- Vede DOAR tabul „General" (read-only). Tab-urile Coordonatori, Membri, Întâlniri/Zile sunt ascunse.

**Pentru diriginte (`homeroom_teacher`) care NU este creator/coordonator:**
- Vede tab „General" (read-only)
- Vede tab „Întâlniri" / „Zile & prezență", DAR lista de membri și grila de prezență sunt filtrate la elevii claselor pe care le conduce (`homeroom_teacher_id = auth.uid()`).
- Nu vede Coordonatori sau lista globală de Membri.

**Admin / CSE / creator / coordonator:** comportamentul actual (acces complet).

### Detalii tehnice

Adaug un flag `viewMode` calculat în detail page:
- `full` — admin/creator/coordonator (canManage actual)
- `homeroom_filtered` — diriginte non-creator → vede General + Întâlniri/Zile filtrate
- `general_only` — profesor non-creator → vede doar General

În `MeetingsTab` / `DaysTab`, dacă `viewMode === "homeroom_filtered"`:
- Încarc `student_class_assignments` pentru `homeroom_teacher_id = auth.uid()` ca să obțin lista `myStudentIds`
- Filtrez `enrollments` (membrii afișați în grila de prezență) și `club_attendance` / `volunteer_attendance` doar la acei studenți
- Ascund butoanele de adăugare/modificare; totul este read-only

RLS-urile existente permit dirigintelui să citească `club_enrollments`, `club_attendance`, `volunteer_enrollments`, `volunteer_attendance` pentru elevii săi (politici `Homeroom read class …` deja existente). RLS-ul pentru `clubs`/`volunteer_projects` permite oricărui authenticated să citească cele cu `status = 'active'`. Nu e nevoie de migrare SQL.

### Fișiere modificate
- `src/components/layouts/ProfLayout.tsx` — bară unificată + tab Module
- `src/components/layouts/TeacherLayout.tsx` — bară unificată + tab Module
- `src/pages/teacher/TeacherReportsPage.tsx` — voluntariat în tab „Sumar"
- `src/components/clubs/ClubDetailPage.tsx` — viewMode + filtrare prezență
- `src/components/clubs/VolunteerProjectDetailPage.tsx` — viewMode + filtrare prezență
