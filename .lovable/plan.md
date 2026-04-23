

## Plan: Pagină „Raport ISMB" în contul de Manager

### Ce se adaugă

O pagină nouă `/manager/ismb-report` care reproduce structura raportului ISMB uploadat, cu secțiuni pre-completate din baza de date și câmpuri editabile (Textarea) pentru textul liber. Managerul poate edita orice secțiune, apoi exporta PDF-ul final.

### Structura paginii

Pagina va conține un formular cu secțiuni editabile, fiecare într-un Card separat:

1. **Descriere generală** (Textarea) — primul paragraf din raport, pre-completat cu text template care include:
   - Perioada sesiunii (din `program_sessions.start_date` / `end_date`)
   - Numărul total de activități (count din `events` pentru sesiune)
   - Text editabil cu descrierea activităților

2. **Tipul activităților** (Textarea) — punctul 2, pre-completat cu textul template din raportul model

3. **Participanți** (pre-completat automat din DB, editabil):
   - Cadre didactice: count DISTINCT `coordinator_assignments.teacher_id` pentru evenimentele sesiunii
   - Elevi: count DISTINCT `reservations.student_id` + count `public_tickets` non-cancelled pentru sesiune
   - Afișat ca text editabil

4. **Parteneri implicați** (Textarea) — text liber, pre-completat cu template

5. **Spații de desfășurare** (pre-completat automat din DB):
   - Se extrag DISTINCT `events.location` pentru sesiune
   - Afișat ca text editabil

6. **Rezultate înregistrate** (Textarea) — pre-completat cu lista din raportul model

7. **Analiza SWOT** (Textarea) — pre-completat cu template-ul complet (Puncte tari, Puncte slabe, Oportunități, Amenințări)

8. **Recomandări, sugestii** (Textarea) — pre-completat cu template

9. **Semnături** (Textarea) — Director, Consilier educativ, Coordonator CEAC

### Buton Export PDF

Un buton „Exportă PDF" în header-ul paginii care:
- Generează un PDF A4 portrait folosind `jsPDF` (pattern existent în `report-pdf.ts`)
- Include antetul „Colegiul Național CANTEMIR-VODĂ" + adresa + nr. înregistrare
- Fiecare secțiune e redată ca titlu + text, cu paginare automată
- Textul trece prin `stripDiacritics` (limitare jsPDF fără fonturi custom)
- Download via `downloadFileMobileSafe`

### Fișiere noi
- `src/pages/manager/ISMBReportPage.tsx` — pagina completă cu state local pentru fiecare secțiune, queries pentru pre-completare, logica de export PDF

### Fișiere modificate
- `src/components/layouts/ManagerLayout.tsx` — adăugare menu item „Raport ISMB" cu icon `FileText`
- `src/App.tsx` — adăugare rută `/manager/ismb-report`

### Detalii tehnice

- State-ul fiecărei secțiuni e un `useState<string>` inițializat la mount cu valorile din DB + template text
- Queries folosite:
  - `events` filtrate pe `session_id` — count total, locații distincte
  - `coordinator_assignments` JOIN `events` — count cadre didactice
  - `reservations` + `public_tickets` — count elevi participanți
- PDF-ul se generează client-side cu `jsPDF`, text wrapping manual via `doc.splitTextToSize()`
- Nu e nevoie de modificări DB sau RLS (managerul are deja SELECT pe toate tabelele relevante)

