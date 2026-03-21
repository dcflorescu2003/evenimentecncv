

## Plan: Inlocuire Export CSV cu Export PDF in Toate Rapoartele

Exista 4 butoane "Export CSV" in aplicatie care trebuie inlocuite cu "Export PDF":

1. **Admin ReportsPage — ClassReport** (raport pe clase)
2. **Admin ReportsPage — EventReport** (raport pe evenimente)
3. **Admin ReportsPage — StudentReport** (raport pe elevi)
4. **TeacherReportsPage** (raport diriginte)

### Abordare

Creez o functie generica de export PDF in `src/lib/report-pdf.ts` care genereaza un document tabelar cu header, titlu raport si tabel autoTable (similar cu `attendance-pdf.ts` existent). Functia va primi: titlu raport, coloane, randuri, si optional un subtitlu.

### Modificari

| Fisier | Ce se schimba |
|--------|--------------|
| `src/lib/report-pdf.ts` (nou) | Functie generica `exportReportPdf(title, headers, rows, subtitle?)` cu jsPDF + autoTable, stripDiacritics |
| `src/pages/admin/ReportsPage.tsx` | Inlocuiesc cele 3 apeluri `exportToCSV` cu `exportReportPdf`, schimb textul butoanelor din "Export CSV" in "Export PDF" |
| `src/pages/teacher/TeacherReportsPage.tsx` | Inlocuiesc apelul `exportToCSV` cu `exportReportPdf`, schimb textul butonului |

### Detalii tehnice

- Reutilizez `jsPDF` si `jspdf-autotable` (deja instalate in proiect)
- Reutilizez functia `stripDiacritics` din `attendance-pdf.ts` (o export sau o duplic in noul fisier)
- Formatul PDF: A4 landscape pentru rapoartele cu multe coloane (EventReport cu 9 coloane), portrait pentru restul
- Header: titlu centrat, subtitlu optional (ex: numele sesiunii), data generarii
- Tabel cu stiluri consistente cu cele din `attendance-pdf.ts` (headStyles albastru, alternate rows)

