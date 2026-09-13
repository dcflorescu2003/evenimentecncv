# Cluburi: formular de înscriere, aprobare, departamente și elev asistent

## Ce se schimbă pentru utilizatori

### 1. Formular de înscriere (opțional, per club)
- La crearea/editarea unui club, coordonatorul poate construi un formular cu întrebări, exact ca la Feedback (o variantă, variante multiple, listă, scară, răspuns deschis; fiecare întrebare poate fi obligatorie).
- Dacă clubul are formular, elevul nu se poate înscrie până nu îl completează. Fără formular, înscrierea rămâne un simplu clic.
- Răspunsurile sunt vizibile coordonatorilor și elevului asistent, în dreptul fiecărui membru.
- Pentru numărul de telefon (grupuri WhatsApp) se folosește o întrebare din formular marcată ca „telefon”; valoarea apare într-o coloană separată în lista de membri, cu buton de copiere a tuturor numerelor.

### 2. Aprobare obligatorie a membrilor
- Orice înscriere intră în starea „În așteptare”. Coordonatorul sau elevul asistent o aprobă sau o respinge.
- Elevul vede clar starea: în așteptare / aprobat / respins. Locurile se ocupă doar la aprobare.
- Membrii adăugați manual sunt aprobați direct.

### 3. Departamente
- În fiecare club se pot crea departamente (nume, descriere).
- Fiecare membru aprobat poate fi asociat unui departament; lista de membri se poate filtra pe departament.

### 4. Elev asistent de club
- Coordonatorul/adminul poate desemna elevi asistenți pentru un club.
- Asistentul poate: adăuga membri manual, gestiona departamente, vedea telefoanele, aproba/respinge înscrieri, marca prezența și scana QR, și crea întâlniri.
- Asistentul nu poate edita setările clubului, nu poate șterge clubul și nu poate desemna alți asistenți.

## Detalii tehnice

Bază de date (migrare nouă):
- `club_form_questions` — `club_id`, `position`, `question_type` (refolosim enumerarea `feedback_question_type`), `text`, `required`, `options`, `scale_*`, plus marcaj `is_phone`.
- `club_enrollment_answers` — `enrollment_id`, `question_id`, `value jsonb`.
- `club_departments` — `club_id`, `name`, `description`; `club_enrollments.department_id` (nullable, FK).
- `club_student_assistants` — `club_id`, `student_id`, `assigned_by` (model preluat din `event_student_assistants`).
- `club_enrollment_status`: valoare nouă `pending`; `rejected` pentru respingere. Înscrierile existente rămân `enrolled`.
- Funcție `security definer` `is_club_student_assistant(_user_id, _club_id)` pentru RLS, plus politici pe toate tabelele noi (elevul își vede doar propriile răspunsuri; personalul clubului vede tot). GRANT-uri pentru `authenticated` și `service_role` la fiecare tabel nou.
- `check_club_enrollment` actualizată: capacitatea și limita per clasă numără doar înscrierile aprobate; înscrierea creează rând `pending`.
- RPC `submit_club_enrollment(_club_id, _answers jsonb)` care validează întrebările obligatorii și scrie atomic înscrierea + răspunsurile.

Frontend:
- Editor de întrebări refolosind `src/components/feedback/QuestionsEditor.tsx` în formularul de club din `ClubsVolunteerHub.tsx`.
- Completare folosind `src/components/feedback/QuestionRenderer.tsx` într-un dialog de înscriere în `StudentClubsPage.tsx` / `ClubDetailPage.tsx`.
- `ClubDetailPage.tsx`: taburi noi „Cereri” (aprobare), „Departamente”, „Asistenți”; coloane telefon + departament în lista de membri; drepturi extinse prin `canManage || isStudentAssistant`.
- Ecranele de prezență/scanare și crearea de întâlniri acceptă și elevul asistent.
