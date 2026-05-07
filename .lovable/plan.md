## Îmbunătățiri dashboard profesor & diriginte

### 1. Calendar evenimente în dashboard (prof + diriginte)

Adaug componenta calendar (cea folosită la elev: `EventsCalendar`) în:
- `src/pages/prof/ProfDashboard.tsx` (profesor & CSE)
- `src/pages/teacher/TeacherDashboard.tsx` (diriginte)

Poziționare: **înainte de „Istoric coordonare"** la profesor, respectiv înainte de tabelul de elevi/istoric la diriginte.

Calendarul va afișa **toate evenimentele publicate, non-publice** (la fel ca la elev, fără filtru — confirmat pentru prof; aplicăm la fel și pentru diriginte). Click pe eveniment → **doar dialog cu detalii** (fără navigare). Pentru asta:
- Adaug în `EventsCalendar` o prop opțională `onEventClick?: (ev) => void` care, dacă e setată, înlocuiește `navigate(...)` cu un callback custom.
- Dashboard-urile prof/diriginte trec un callback ce deschide un `Dialog` simplu cu titlu, dată, oră, locație, descriere, capacitate.
- `myReservationIds` va fi `new Set()` gol (nu sunt rezervări de elev), iar `reservationCounts` se ia din RPC `get_events_reserved_counts` (deja folosit).

### 2. Reordonare carduri Dashboard profesor

În `ProfDashboard.tsx`, ordinea actuală e: Active coord → Istoric → Evenimentele mele.
Noua ordine cerută: **Evenimentele mele înainte de Istoric**.
Final: Active coord → **Calendar** → **Evenimentele mele** → Istoric coordonare.

(Pentru diriginte, dashboard-ul actual nu are secțiunea „Evenimentele mele", deci doar inserăm Calendarul înainte de tabelul cu elevi/„Istoric"-ul lor.)

### 3. Buton „Rapoarte" la dreapta lui „Clasa mea" pentru diriginte

În `src/components/layouts/TeacherLayout.tsx` ordinea actuală e: Dashboard, Evenimentele mele, Clasa mea, Rapoarte — deci Rapoarte e deja după „Clasa mea". Verific și mă asigur că pentru rolul de **doar diriginte** (fără teacher) butonul Rapoarte apare corect lângă „Clasa mea". Dacă layout-ul folosit pentru diriginte e `ProfLayout` în loc de `TeacherLayout` (când rolul e doar `homeroom_teacher`), îmi rezultă din `ProfLayout.tsx` că lipsește butonul „Rapoarte" — îl voi adăuga acolo, imediat după „Clasa mea", vizibil doar dacă `isHomeroom`.

### 4. Tab „Verificare prezență" — preselect și filtre relevante clasei

În `src/pages/teacher/TeacherReportsPage.tsx`, componenta `VerificarePrezentaTab`:

a) **Filtrarea evenimentelor relevante**: 
- Pe lângă `sessionEvents`, voi face o interogare suplimentară pentru a determina evenimentele unde **există elevi din clasa diriginte înscriși** (prin `reservations` join `student_class_assignments` pe `classIds` și pe `event_id IN sessionEvents`).
- Set rezultat = `relevantEventIds`. 
- Lista din `Select` „Selectează evenimentul" va arăta **doar** evenimentele din `relevantEventIds`, sortate descrescător după dată.
- `uniqueDates` se calculează **doar** din evenimentele relevante.

b) **Preselectare ultimul eveniment finalizat**:
- După încărcare, dacă `selectedEventId` e gol, setez automat la primul eveniment cu `date <= today` din lista relevantă (sortată descrescător) — adică ultimul finalizat unde clasa a avut elevi înscriși.
- Folosesc un `useEffect` care depinde de `relevantEvents` și `classIds`/`sessionId`. La schimbarea sesiunii sau clasei se resetează și recalculează.

### Detalii tehnice

Files modificate:
- `src/pages/prof/ProfDashboard.tsx` — query nou pentru evenimente publicate + counts, render `EventsCalendar` între active și istoric, mută „Evenimentele mele" deasupra istoricului, dialog detalii eveniment.
- `src/pages/teacher/TeacherDashboard.tsx` — același calendar + dialog, plasat înainte de tabelul de elevi.
- `src/components/student/EventsCalendar.tsx` — adaug prop opțional `onEventClick` care, dacă există, e apelat în loc de `navigate(...)` în cele 3 locuri (linii ~272, 315, 419).
- `src/components/layouts/ProfLayout.tsx` — adaug item „Rapoarte" pentru `isHomeroom` lângă „Clasa mea".
- `src/pages/teacher/TeacherReportsPage.tsx` — în `VerificarePrezentaTab`: query nou pentru `relevantEventIds`, filtrez `sessionEvents` și `uniqueDates`, `useEffect` pentru preselect ultimul finalizat.

Nu sunt necesare migrații DB sau modificări de RLS — toate datele sunt deja accesibile diriginților prin politicile existente (`Homeroom teachers read event reservations` & `read class assignments`).
