
# Plan: Modul „Feedback"

Modul nou în registry (`/app` → „Feedback"), cu acces pentru Admin, CSE, Profesor, Diriginte, Elev. Reia pattern-urile din modulul „Cluburi & Voluntariat" (eligibilitate clasă/an, RLS prin security definer, navigare jos cu 2 butoane).

---

## 1. Tipuri de chestionare

- `general` — chestionar standard pentru elevi (anonim sau non-anonim).
- `teacher_feedback` — elevul alege un profesor din **orarul clasei sale** și completează chestionarul; un răspuns per (chestionar, profesor); rezultatele vizibile profesorului evaluat (+ Admin).
- `teacher_survey` — chestionar pentru profesori (doar Admin îl poate crea), profesorii răspund, rapoarte centralizate la Admin.

Anonimat:
- `anonymous` (default pentru `teacher_feedback`): nu se salvează `respondent_id`; banner explicit „Răspuns anonim".
- `identified`: se salvează `respondent_id`; banner „Identitatea ta este vizibilă creatorului".
- `anonymous_optional`: implicit anonim, dar respondentul poate bifa „Vreau să fiu identificat" la trimitere.

Editare după trimitere:
- Anonim → final, fără editare.
- Non-anonim (sau anonim cu identificare bifată) → editabil până la `closes_at`.

---

## 2. Schema DB (migration unic)

Enums:
- `feedback_type`: `general | teacher_feedback | teacher_survey`
- `feedback_anonymity`: `anonymous | identified | anonymous_optional`
- `feedback_audience`: `students | teachers`
- `feedback_status`: `draft | active | closed`
- `feedback_question_type`: `single_choice | multi_choice | dropdown | scale | open_text`

Tabele (toate cu GRANT pentru `authenticated` + `service_role`, RLS activat):

- `feedback_forms` — `title`, `description`, `type`, `anonymity`, `audience`, `status`, `session_id`, `opens_at`, `closes_at`, `eligible_grades int[]`, `eligible_classes uuid[]`, `created_by`, `created_at`, `updated_at`.
- `feedback_questions` — `form_id`, `position`, `question_type`, `text`, `required bool`, `options jsonb` (variante pentru choice/dropdown), `scale_min int`, `scale_max int`, `scale_min_label`, `scale_max_label`.
- `feedback_responses` — `form_id`, `respondent_id` (nullable când anonim), `subject_teacher_id` (nullable, doar la `teacher_feedback`), `submitted_at`, `is_identified bool`, `class_id` (snapshot pentru rapoarte agregate). Unique: `(form_id, respondent_id, subject_teacher_id)` când `respondent_id IS NOT NULL`.
- `feedback_answers` — `response_id`, `question_id`, `value jsonb` (text, număr, sau array de opțiuni).

Security definer functions:
- `is_feedback_creator(_form_id, _user)`, `is_feedback_eligible_student(_form_id, _user)`, `is_feedback_target_teacher(_response_id, _user)`, `check_feedback_submission(_form_id, _user, _teacher_id)` (verifică status, fereastră, eligibilitate clasă/an, anti-duplicat).

Vizibilitate rezultate (confirmat: doar creator + Admin):
- `general` / `teacher_survey`: read pentru `created_by` și `admin`.
- `teacher_feedback`: read pentru `admin`, `created_by` și profesorul evaluat (`subject_teacher_id = auth.uid()` prin security definer).
- Elev: vede propriul răspuns (dacă non-anonim sau identificat opțional).

---

## 3. Editor de chestionare (stil Google Forms)

Componentă `FeedbackFormEditor` cu listă de întrebări drag-to-reorder. Tipuri:

- **Single choice** — listă de opțiuni, radio la răspuns.
- **Multiple choice** — listă de opțiuni, checkbox la răspuns.
- **Dropdown** — listă de opțiuni, Select.
- **Scale** — min/max (ex. 1–5, 1–10) + etichete capete; Slider sau buline numerotate.
- **Open text** — Textarea cu limită de caractere.

Fiecare întrebare are toggle „obligatoriu". Salvare normalizată în `feedback_questions` cu `options jsonb`.

Setări form: titlu, descriere, tip, anonimat, perioadă (`opens_at`/`closes_at` cu `DateInput`), filtre clase/ani (reutilizez `ClassEligibilityPicker`), audiență.

---

## 4. UI — Rute & layout

Înregistrare modul în `src/modules/registry.ts` (key `feedback`, label „Feedback", icon `MessageSquare`).

Rute noi:
- `/admin/feedback`, `/admin/feedback/new`, `/admin/feedback/:id`, `/admin/feedback/:id/report`
- `/prof/feedback`, `/prof/feedback/new`, `/prof/feedback/:id`, `/prof/feedback/:id/report`
- `/student/feedback`, `/student/feedback/:id/respond`, `/student/feedback/:id/respond/:teacherId`

Navigare bottom (asemănător `StudentLayout` pentru Cluburi):
- **Elev**: când `/student/feedback*` → 2 butoane: `Dashboard` (chestionare deschise + istoric), `Feedback-ul meu` (răspunsurile mele).
- **Profesor/Diriginte/CSE**: când `/prof/feedback*` → 2 butoane: `Dashboard` (chestionarele pe care le văd / la care răspund), `Feedback-ul meu` (chestionarele create de mine + buton „Creează chestionar"). Pentru profesori, aici apar și rapoartele pe `teacher_feedback` unde sunt subiect.

Componente principale:
- `FeedbackDashboardStudent` — carduri „Deschise" și „Istoric".
- `FeedbackFillPage` — randează întrebările pe baza `question_type`; pentru `teacher_feedback` precedat de selector profesor (Combobox cu profesorii din orarul clasei elevului → query pe `class_schedules` + `teacher_initials`/`profiles`).
- `FeedbackMineStudent` — lista răspunsurilor proprii (cu badge anonim/identificat); editabil doar non-anonim, înainte de `closes_at`.
- `FeedbackListAdminLike` — listă chestionare proprii cu acțiuni (publică/închide/duplică/șterge, vezi rapoarte).
- `FeedbackReportPage` — agregare per întrebare (bare/donut pentru choice, histogramă/medie pentru scale, listă răspunsuri text) + tab „Răspunsuri individuale" (doar non-anonim) + filtre (clasă, perioadă, profesor pentru `teacher_feedback`). Buton „Export PDF" via `lib/report-pdf.ts` (jsPDF).

---

## 5. Reguli & validări

- O dată per chestionar (anti-duplicat prin unique key). La `teacher_feedback`: o dată per (chestionar, profesor) — elevul poate completa pentru fiecare profesor al său.
- Filtre clase/ani aplicate exact ca la evenimente (`eligible_classes` / `eligible_grades`).
- `check_feedback_submission` RPC verifică: status `active`, fereastra `opens_at/closes_at`, eligibilitate clasă, anti-duplicat, iar la `teacher_feedback` că profesorul ales chiar predă clasei elevului.
- Anonim: edge function `submit-feedback` inserează cu `respondent_id = NULL` chiar dacă este apelată cu JWT (folosește service role doar pentru insert; verifică eligibilitate prin RPC înainte). Asta protejează identitatea chiar și în log-urile DB.

---

## 6. Notificări

- La publicarea unui chestionar `general` / `teacher_feedback` → notificare in-app + push elevilor din clasele eligibile (refolosesc pattern-ul din notifications).
- La `teacher_survey` publicat → notificare profesorilor eligibili.
- Reminder cu 24h înainte de `closes_at` pentru cei care n-au răspuns (cron zilnic, similar `send-event-reminders`).

---

## 7. Export PDF

`lib/feedback-pdf.ts` (jsPDF) — header CNCV, titlu chestionar, perioada, filtrele aplicate, pentru fiecare întrebare: enunț + grafic/tabel + statistici (n, %, medie, mediană la scale). La final, anexă cu răspunsuri individuale (doar dacă non-anonim și user-ul a cerut-o).

---

## 8. Memorie

După implementare, adaug `mem://features/feedback` cu rezumat (tipuri, anonimat, vizibilitate creator+admin, anti-duplicat, navigare bottom 2 butoane) și update la `mem://index.md`.

---

## 9. Etapizare livrare

1. **Schema DB**: enums, tabele, GRANTs, RLS, security definer functions, `check_feedback_submission` RPC.
2. **Module registry + rute + layout bottom-nav** (2 butoane elev / profesor).
3. **Editor de chestionare** (toate cele 5 tipuri de întrebări) + listă chestionare proprii.
4. **Răspunsuri**: `FeedbackFillPage` (cu selector profesor la `teacher_feedback`), edge function `submit-feedback` cu logica de anonimat.
5. **Rapoarte** agregate + individuale, filtrare, export PDF.
6. **Notificări** la publicare + reminder zilnic prin cron.
7. **Memory update**.

---

## Întrebări deschise / sugestii

- **Reminder de răspuns**: ok să trimit auto la 24h înainte de `closes_at` (push + in-app) doar celor care n-au răspuns?
- **Duplicare chestionar**: util de avut buton „Duplică" pentru reutilizare anuală — îl includ implicit.
- **Template-uri**: să prevăd o bibliotecă mică de chestionare standard (ex. „Evaluare semestrială profesor", „Feedback eveniment") pe care Adminul le poate clona? Recomand să le adăugăm în etapa 3.
- **Răspunsuri text deschise la chestionare anonime**: rămân vizibile creatorului ca text, fără asociere — confirmi?

Confirmă planul (și răspunsurile la cele 4 puncte de mai sus) și trec la etapa 1.
