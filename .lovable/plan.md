

## Plan: Optimizare mobil pentru aplicație

### Probleme identificate

1. **Dialoguri (formulare)** — multe `DialogContent` au doar `max-w-2xl` fără `max-h-[90vh] overflow-y-auto`, iar pe ecrane înguste padding-ul `p-6` + grid-uri `grid-cols-2` sparg layout-ul. Exemplu: formularul de creare eveniment în `EventsPage.tsx`, `SessionsPage.tsx`, `ClassesPage.tsx`, `UsersPage.tsx`.
2. **Tabele largi** — multe `<Table>` nu au wrapper `overflow-x-auto`, deci se sparg pe mobil (ex: EventsPage admin, AuditPage, ProfEventsPage, ReportsPage etc.).
3. **Header-e pagini** — patternul `flex items-center justify-between` cu titlu + buton mare pe dreapta nu se rupe pe mobil. Butoanele cu text lung depășesc.
4. **Layout-uri (Prof, Teacher, Coordinator)** — bara de navigare orizontală cu butoane pline (`icon + text`) ocupă mult spațiu și deși scrollează, e incomodă. Header-ul afișează nume utilizator care e tăiat.
5. **ManagerLayout** — sidebar offcanvas funcționează ok pe mobil, dar header-ul cu „Sesiune: ..." e prea lung și depășește.
6. **Filtre inline** (`flex flex-wrap gap-3`) — selectoarele cu lățime fixă `w-[200px]` nu se adaptează.

### Soluție

**1. Componenta `DialogContent` — fix global**
Modific `src/components/ui/dialog.tsx` să folosească by-default lățime responsive + scroll vertical:
```tsx
"... w-[calc(100vw-2rem)] max-w-lg max-h-[90vh] overflow-y-auto p-4 sm:p-6 ..."
```
Asta rezolvă instant toate dialogurile din aplicație fără modificări individuale.

**2. Grid-uri `grid-cols-2` în formulare → responsive**
În formularele cu probleme reale (EventsPage admin, SessionsPage, ClassesPage, UsersPage, ProfEventsPage), schimb `grid grid-cols-2 gap-4` → `grid grid-cols-1 sm:grid-cols-2 gap-4`.

**3. Wrapper scroll pentru tabele**
Adaug `<div className="overflow-x-auto">` în jurul tuturor `<Table>` care nu îl au deja, în paginile principale: AuditPage, EventsPage admin, ProfEventsPage, ClassesPage, ReportsPage, manager pages.

**4. Header-e responsive în pagini**
Pattern-ul de înlocuit:
```tsx
<div className="flex items-center justify-between">
  <div>...titlu...</div>
  <Button>Eveniment nou</Button>
</div>
```
Devine:
```tsx
<div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
```
Aplicat pe paginile cu butoane de acțiune în header.

**5. Filtre responsive**
Selectoare `w-[200px]` → `w-full sm:w-[200px]`, container `flex flex-wrap` → `flex flex-col sm:flex-row sm:flex-wrap gap-2`.

**6. Layout-uri (Prof / Teacher / Coordinator)**
- Header: ascund numele utilizatorului pe mobil (`hidden sm:inline`), reduc padding la `px-3`.
- Bară navigare: trec la **icon-only pe mobil** cu text vizibil de la `sm:` în sus. Butoanele devin compacte: `<item.icon /> <span className="hidden sm:inline ml-2">{item.title}</span>`.

**7. ManagerLayout header**
- „Sesiune: X" se trunchează cu `truncate` și devine doar selectorul activ pe mobil.

### Ce NU schimbăm
- AdminLayout: deja folosește `Sidebar` shadcn cu offcanvas pe mobil → funcționează ok.
- StudentLayout: deja are bottom nav optimizat pentru mobil.
- Logica de business, queries, RLS — nimic.

### Fișiere modificate
- `src/components/ui/dialog.tsx` (fix global)
- `src/components/layouts/ProfLayout.tsx`
- `src/components/layouts/TeacherLayout.tsx`
- `src/components/layouts/CoordinatorLayout.tsx`
- `src/components/layouts/ManagerLayout.tsx`
- `src/pages/admin/EventsPage.tsx` (header + filtre + grid form + tabel scroll)
- `src/pages/admin/SessionsPage.tsx` (header + form + tabel)
- `src/pages/admin/ClassesPage.tsx` (header + dialog forms)
- `src/pages/admin/UsersPage.tsx` (header + dialog forms + tabel)
- `src/pages/admin/AuditPage.tsx` (filtre + tabel scroll)
- `src/pages/admin/ReportsPage.tsx` (tabele scroll)
- `src/pages/admin/ImportPage.tsx` (tabele deja au overflow, doar header)
- `src/pages/prof/ProfEventsPage.tsx` (header + filtre + tabel)
- `src/pages/prof/ProfEventDetailPage.tsx` (grid forms + tabele)
- `src/pages/teacher/TeacherReportsPage.tsx` (filtre + tabele)
- Pagini manager (`SessionReportPage`, `DayReportPage`, `EventReportPage`, `ClassReportPage`, `StudentReportPage`, `TeacherReportPage`, `IncompleteNormPage`) — doar wrapper scroll pe tabele.

### Rezultat
Toate paginile încap pe ecrane de 360-414px lățime fără overflow orizontal. Formularele din dialoguri sunt scrollabile vertical și se adaptează la o singură coloană. Tabelele largi pot fi scrollate orizontal în interiorul cardului. Meniurile din header devin compacte (doar iconițe pe mobil).

