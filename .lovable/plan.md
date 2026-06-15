# Modul „Portofoliu" — plan de implementare

Modul nou pentru profesorii desemnați de admin, care ține evidența activității lor (clase, portofolii elevi, teme, concursuri, documente, jurnal, propriul portofoliu profesional). Elevii participă activ: trimit teme și declară implicare.

Implementăm pe **6 etape** independente, fiecare livrabilă și utilizabilă. După fiecare etapă confirmi că merge înainte să trec la următoarea.

---

## Fundație tehnică (comună tuturor etapelor)

- **Acces**: tabel nou `module_access(user_id, module_key)` + funcție `has_module_access(_uid, _key)`. Admin bifează din `UsersPage` cine primește `portfolio`. `src/modules/registry.ts` și `AppHub` afișează cardul „Portofoliu" doar dacă utilizatorul are acces (sau e admin).
- **Layout**: `PortfolioLayout` cu navigație proprie + rute `/portfolio/*`. Header reutilizează `ModuleSwitcher`.
- **Storage**: bucket privat `portfolio-files` (10MB/fișier, ca `event-files`), RLS pe `storage.objects` — profesorul vede tot ce a încărcat el; elevul vede doar fișierele aprobate din propriul portofoliu.
- **Audit**: toate aprobările/respingerile/ștergerile loghează în `audit_logs`.
- **Multi-an**: tabelele relevante (teme, jurnal, documente, diplome) au `academic_year` text (ex. „2025-2026").

---

## Etapa 1 — Fundație + Dashboard + Clase și elevi (pct. 1, 2)

**Backend**

- Migration: `module_access`, `portfolio_teacher_classes(teacher_id, class_id, academic_year)`, `portfolio_student_notes(teacher_id, student_id, note, created_at)`.
- Bucket `portfolio-files` + RLS de bază.
- Edge function `portfolio-grant-access` (admin-only) pentru a acorda/revoca accesul.

**Frontend**

- `PortfolioLayout` + rute.
- `PortfolioDashboard`: carduri cu numerele „teme active / netrimise / voluntariat în așteptare / concursuri apropiate / documente cu termen / activitate recentă". În etapa 1 cifrele sunt 0; vor crește pe măsură ce adăugăm etapele.
- `PortfolioClassesPage`: listă clase asignate, filtre.
- `PortfolioStudentListPage` (per clasă): tabel elevi, sortat după nume.
- `PortfolioStudentFilePage`: fișă elev cu tab-uri goale (Portofoliu, Teme, Implicare, Concursuri, Observații) + observații interne salvate acum.
- UI Admin în `UsersPage`: switch „Acces Portofoliu" per profesor.

---

## Etapa 2 — Portofolii elevi + Teme de portofoliu + Trimiteri elev (pct. 3, 4, 5)

**Backend**

- Tabele:
  - `portfolio_assignments` (titlu, descriere, deadline, clase, tip predare: file/photo/link/text, criterii, status).
  - `portfolio_submissions` (assignment_id, student_id, content_text, file_path, link, status: pending/approved/rejected/redo, teacher_feedback, score?).
  - `portfolio_items` (student_id, owner_teacher_id, title, type: lucrare/poză/temă/proiect/diplomă/voluntariat/feedback/observație, file_path, tags[], pinned, source: manual/submission/competition/volunteer, source_id, academic_year).
- RLS: profesorul gestionează doar elevii din clasele lui; elevul vede temele care îl vizează și trimite/edita propria trimitere până la deadline; vede propriul portofoliu (doar `approved`).
- Edge function `portfolio-export-student` → PDF cu tot portofoliul aprobat (folosește `jspdf` + `pdf-font.ts`).

**Frontend profesor**

- `PortfolioAssignmentsPage` (listă + creare/edit) cu vizualizare „cine a trimis / cine nu / în verificare / aprobate / refacere".
- `PortfolioSubmissionReviewPage`: aprobă/respinge/cere refacere, atașează la portofoliul elevului cu un click.
- `PortfolioStudentFilePage` → tab „Portofoliu" funcțional: galerie + upload manual + marcare pinned + export PDF.

**Frontend elev**

- Card nou „Portofoliu" în `StudentLayout` (vizibil doar dacă există cel puțin o temă/un item pentru el).
- `StudentPortfolioPage`: teme active cu trimitere (upload/text/link), istoric trimiteri, portofoliu personal vizualizare.

---

## Etapa 3 — Implicare în clasă + Generator „Cine iese la tablă?" (pct. 6, 7)

**Backend**

- `portfolio_involvement` (student_id, teacher_id, type: voluntariat/ajutor/proiect/eveniment/sprijin/club/materiale, description, hours, status, teacher_note, attach_to_portfolio).
- `portfolio_board_picks` (teacher_id, class_id, student_id, date, lesson, mode, score?, note, attach_to_portfolio).
- Trigger: la `approved` pe involvement cu `attach_to_portfolio = true` → insert automat în `portfolio_items`.

**Frontend profesor**

- `PortfolioInvolvementPage`: coadă de validare (aprobă/respinge/modifică ore/observații).
- `BoardPickerPage`: selectează clasa + mod (aleator / echilibrat / fără repetare / fără absenți / fără ascultați azi / manual), istoric, opțional salvează cu punctaj.

**Frontend elev**

- Tab „Declar implicare" în `StudentPortfolioPage` — formular cu cele 7 tipuri.

---

## Etapa 4 — Concursuri (pct. 8)

**Backend**

- `portfolio_competitions` (titlu, descriere, tip, dificultate, clase, deadline înscriere, dată concurs, link regulament, locuri, individual/echipă, status).
- `portfolio_competition_signups` (competition_id, student_id, status: interesat/selectat/înscris, rezultat, diploma_file_path, proiect_file_path).

**Frontend**

- `PortfolioCompetitionsPage` (profesor): listă + creare + tabel pe etape (interesați/selectați/înscriși/rezultate).
- Elev: tab nou „Concursuri" în `StudentPortfolioPage` — vede oportunitățile pentru clasa lui, butoane „Mă interesează" / vizualizare status.
- Diploma elev → push automat în `portfolio_items` cu sursa `competition`.

---

## Etapa 5 — Documente birocratice + Jurnal profesional + Portofoliu profesor (pct. 9, 10, 11)

**Backend**

- `portfolio_documents` (teacher_id, titlu, categorie ENUM cu cele 13 tipuri, academic_year, class_id?, deadline?, status, file_path, observații).
- `portfolio_journal` (teacher_id, data, titlu, descriere, tip ENUM cu cele 11 tipuri, class_id?, student_ids[], rezultate, observații, next_steps, relevant_for_annual_report).
- `portfolio_teacher_items` (teacher_id, categorie: cv/adeverință/certificat/diplomă/curs/proiect/raport/material/aplicație/comisie, titlu, versiune, file_path, an).
- `portfolio_student_diplomas` (teacher_id, student_id, concurs, premiu, data, file_path, observații) — apare în portofoliul elevului ȘI al profesorului.

**Frontend**

- `PortfolioDocumentsPage`: vizualizare pe categorii + termene + filtre an școlar.
- `PortfolioJournalPage`: timeline + adăugare rapidă.
- `PortfolioTeacherPage`: secțiuni vizuale pentru CV (cu versiuni), certificate, materiale + sub-tab „Diplome elevi" cu upload care creează automat și itemul în portofoliul elevului.

---

## Etapa 6 — Rapoarte și exporturi (pct. 12)

**Backend**

- `portfolio-report` edge function care primește `{ type, scope, period }` și întoarce date agregate.
- Tipuri raport: anual, pe clasă, voluntariat, concursuri, portofolii elevi, listă elevi implicați, listă elevi cu teme netrimise, activități într-un interval.

**Frontend**

- `PortfolioReportsPage`: selectoare + preview tabel + butoane „Export PDF" și „Export CSV" (folosește `report-pdf.ts` și `csv-export.ts` existente).
- Buton „Export portofoliu elev (PDF)" și pe `PortfolioStudentFilePage` (deja construit la etapa 2, reutilizat).
- Buton „Export portofoliu profesor (PDF)" pe `PortfolioTeacherPage`.

---

## Detalii tehnice transversale

- **Rute**: toate sub `/portfolio/*`, protejate prin `ProtectedRoute` + check `has_module_access(uid, 'portfolio')`.
- **RLS pattern**: funcții `security definer` `portfolio_is_owner_teacher_of_student(_t, _s)` și `portfolio_can_view_item(_uid, _item_id)` pentru a evita recursia.
- **Naming**: toate tabelele prefixate `portfolio_` ca să fie ușor de filtrat/șters dacă vrei să dezactivezi modulul.
- **Mobil**: layout responsiv (Capacitor friendly), aceleași `header-safe` / `pb-safe` ca restul aplicației.
- **Limbă**: tot UI-ul în română, date în format `zz.ll.aaaa` cu `DateInput`.

---

## Confirmări de la tine înainte să încep etapa 1

1. OK cu structura pe 6 etape de mai sus?
2. La etapa 1, vrei ca **clasele asignate** să fie introduse manual de admin/profesor în `portfolio_teacher_classes`, sau să se deducă automat din date existente (ex. `homeroom_teacher` + clase pentru care a făcut evenimente)?
3. Pentru export PDF portofoliu elev — vrei să includă **și** materialele declarate de elev dar încă neaprobate, sau doar cele aprobate?

După confirmare, încep imediat etapa 1.  
1. Ok  
2. Clasele momentan sunt introduse manual  
3. Doar cele aprobate

---

## Stare implementare
- Etapa 1 — ✅ implementată
- Etapa 2 — ✅ implementată
- Etapa 3 — ✅ implementată
- Etapa 4 — ✅ implementată (concursuri + înscrieri elevi + diplome auto în portofoliu)
- Etapa 5 — ✅ implementată (documente, jurnal profesional, portofoliu profesor + diplome elevi)
- Etapa 6 — în așteptare (rapoarte și exporturi)