## Etapa 6 — Rapoarte și exporturi (Portofoliu)

Finalizează modulul cu o pagină dedicată de rapoarte pentru profesor, cu agregări multiple și export PDF/CSV.

### 1. Pagină nouă: `PortfolioReportsPage`
Rută: `/portfolio/reports`, adăugată în `PortfolioLayout` pe rândul 2 (lângă „Portofoliul meu"), iconiță `BarChart3`.

Filtre comune (sus):
- An școlar (din clasele asignate, implicit anul curent)
- Clasă (toate / una anume)
- Interval date (opțional, pentru jurnal/board picks)

### 2. Tipuri de rapoarte (tab-uri)

**a) Per clasă** — pentru o clasă selectată, listă elevi cu:
- nr. teme trimise / aprobate
- nr. implicări aprobate + total ore
- nr. concursuri (înscris / participat / premiat)
- nr. diplome
- nr. răspunsuri la tablă + medie punctaj

**b) Per elev** — fișă agregată cu toate elementele din `portfolio_items` grupate pe sursă (submission, involvement, competition, diploma, board_pick), plus observații.

**c) Activitate profesor** — pentru profesorul logat:
- teme create, trimiteri evaluate
- implicări aprobate/respinse
- concursuri organizate, înscrieri
- intrări jurnal (total + marcate pentru raport anual)
- documente birocratice pe categorie
- materiale proprii adăugate

**d) Raport anual** — agregare bazată pe `portfolio_journal.relevant_for_annual_report = true` + statistici globale pe anul școlar selectat (text pregătit pentru copiere în raportul oficial).

### 3. Export

Toate tipurile suportă:
- **PDF** — generat client-side cu `jspdf` + `pdf-font.ts` (reutilizăm pattern din `attendance-pdf.ts` / `report-pdf.ts`). Header cu logo CNCV, titlu raport, an școlar, data generării.
- **CSV** — prin `csv-export.ts` existent.

Funcții helper noi în `src/lib/portfolio-report.ts`:
- `buildClassReport(classId, year)`
- `buildStudentReport(studentId, year)`
- `buildTeacherActivityReport(teacherId, year)`
- `buildAnnualReport(teacherId, year)`
- `exportReportPdf(report, type)` / `exportReportCsv(report, type)`

### 4. Dashboard — link rapid
În `PortfolioDashboard` adăugăm un card „Rapoarte" care duce direct la `/portfolio/reports`.

### 5. Fără modificări de schemă
Toate datele necesare există deja (Etapele 1–5). Folosim doar `SELECT`-uri cu join-uri prin client. **Nu e nevoie de migrație** și **nu e nevoie de edge function** — agregările sunt mici (per clasă/elev/profesor) și se pot face client-side sau prin RPC-uri simple `count`/`group by` existente.

### Detalii tehnice
- Fișiere noi: `src/pages/portfolio/PortfolioReportsPage.tsx`, `src/lib/portfolio-report.ts`
- Modificate: `src/App.tsx` (rută), `src/components/layouts/PortfolioLayout.tsx` (nav rândul 2), `src/pages/portfolio/PortfolioDashboard.tsx` (card link)
- Reutilizare: `jspdf`, `pdf-font.ts`, `csv-export.ts`, `DateInput`, Combobox pentru selectare elev
- UI 100% în română, sortare alfabetică „Nume Prenume" după `last_name` (locale ro)
- Format date `zz.ll.aaaa`, ore `HH:MM`

După aprobare implementez tot într-un singur pas.