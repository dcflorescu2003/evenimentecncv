## Obiectiv

Adăugarea unui nou tip de cont **CSE** (Consiliul Școlar al Elevilor) — similar cu un profesor, dar tratat separat la nivel de UI și etichetat distinct peste tot unde apar evenimente.

---

## 1. Bază de date

### Rol nou

- Adăugare valoare `'cse'` în enum-ul `app_role` (migrație: `ALTER TYPE public.app_role ADD VALUE 'cse'`).

### Marcare evenimente CSE

- Adăugare coloană `is_cse boolean NOT NULL DEFAULT false` în tabela `events`.
- Setată automat la `true` când evenimentul este creat de un user cu rolul `cse`.

### RLS / Politici (tabela `events`)

- `CSE create events` — INSERT permis dacă `has_role(auth.uid(), 'cse') AND created_by = auth.uid()`.
- `CSE read own events` — SELECT pentru evenimentele proprii.
- `CSE update own events` — UPDATE doar pe evenimentele proprii.
- `CSE delete own events` — DELETE doar pe evenimentele proprii.

### Politici similare pe tabele conexe

- `coordinator_assignments`, `event_student_assistants`, `event_files`, `reservations` (read), `tickets` (read/update), `public_reservations`, `public_tickets`: adăugare politici pentru rolul `cse` urmând modelul existent pentru `teacher`/`homeroom_teacher` (cu condiția `is_event_creator(event_id, auth.uid())`).
- Diriginții și profesorii coordonatori existenți pot vedea în continuare evenimentele CSE pe care au elevi înscriși (politicile lor curente nu se schimbă — funcționează deja).

---

## 2. Edge function — admin-manage-users

- Adăugare `'cse'` în lista de roluri valide la creare/editare cont.
- Tratat ca `teacher` din punct de vedere al `teaching_norm` (NU se aplică — opțional, sau se ignoră complet la CSE).
- La creare: parolă default `Cncv1234#`, `must_change_password = true`.

---

## 3. UI — Admin

### `UsersPage.tsx` & `CredentialsPage.tsx`

- Adăugare opțiune `cse` în dropdown-ul de roluri cu eticheta **„CSE”**.
- Filtre & coloane: rolul CSE apare ca badge separat, cu culoare distinctă (ex: violet/indigo).
- `CredentialsPage`: secțiune nouă „Membri CSE” pentru export PDF credențiale.

---

## 4. UI — Layout & rute pentru CSE

### Strategie: refolosim infrastructura `prof` cu adaptări

- **Login redirect**: după autentificare, user cu rol `cse` → `/cse`.
- `**ProtectedRoute**`: adăugare `cse` în `AppRole` și redirect.
- **Rute noi în `App.tsx**`:
  - `/cse` → `CseDashboard`
  - `/cse/events` → `CseEventsPage`
  - `/cse/events/:id` → `CseEventDetailPage`
  - `/cse/scan/:eventId` → `CseScanPage`
  - `/cse/event/:eventId` → `CseEventParticipantsPage`
- `**CseLayout.tsx**`: clonă `ProfLayout` cu titlu „CNCV CSE” și culoare/iconiță distinctă (ex: `Megaphone` sau `Users`).

### Pagini CSE (clone adaptate din `prof/*`)

- `**CseEventsPage**`: identic cu `ProfEventsPage`, dar:
  - Filtrul `eligible_grades` permite doar **9, 10, 11, 12** (ascunse 5,6,7,8).
  - **NU se afișează lista de clase pe litere** — doar checkbox-uri per an. La salvare: `eligible_classes = null`, `eligible_grades = [9,10,11,12]` (subset selectat).
  - La INSERT, payload include `is_cse: true`.
- `**CseEventDetailPage**`: lista participanților + asignare asistenți (din lista celor deja înscriși) + raport prezenți/absenți.
- `**CseScanPage**` & `**CseEventParticipantsPage**`: clone funcționale ale celor existente.

---

## 5. Eticheta „Eveniment CSE” — vizibilitate cross-rol

Adăugare badge **„Eveniment CSE”** (culoare distinctă, ex: violet) oriunde se listează evenimente, dacă `event.is_cse === true`:

- **Calendar elev** (`src/components/student/EventsCalendar.tsx`) — badge în card-ul evenimentului.
- **Dashboard elev** (`StudentDashboard.tsx`, `StudentEventsPage.tsx`, `StudentEventDetailPage.tsx`).
- **Pagini profesor / diriginte** (`ProfEventsPage`, `ProfEventDetailPage`, `TeacherDashboard`, `TeacherReportsPage`).
- **Pagini admin** (`EventsPage`, `EventDetailPage`).
- **Pagini manager** (rapoarte: `EventReportPage`, `DayReportPage`, `ClassReportPage`, `StudentReportPage`).
- **Coordonator & public**: la fel.

Componentă mică reutilizabilă: `<CseBadge />` (badge cu text „CSE” + tooltip „Eveniment organizat de Consiliul Școlar al Elevilor”).

---

## 6. Restricții CSE — eligibilitate

În `CseEventsPage`:

- Lista de ani: **doar [9, 10, 11, 12]** (înlocuiește lista completă).
- **Eliminăm** secțiunea de clase pe litere (A, B, C, D…) — CSE alege doar la nivel de an.
- La submit: `eligible_classes = null` întotdeauna; doar `eligible_grades` populat.

---

## 7. Rapoarte diriginte

Verificare: rapoartele dirigintelui (`TeacherReportsPage`, situație elevi) deja agregă pe baza `reservations` și a evenimentelor cu prezență validată — vor include automat și evenimentele CSE. Adăugăm doar badge vizual „CSE” lângă titlul evenimentului în matrice/listă.

---

## Detalii tehnice

**Fișiere noi:**

- `supabase/migrations/<ts>_add_cse_role_and_events.sql`
- `src/components/layouts/CseLayout.tsx`
- `src/components/CseBadge.tsx`
- `src/pages/cse/CseDashboard.tsx`
- `src/pages/cse/CseEventsPage.tsx`
- `src/pages/cse/CseEventDetailPage.tsx`
- `src/pages/cse/CseScanPage.tsx`
- `src/pages/cse/CseEventParticipantsPage.tsx`

**Fișiere editate:**

- `src/App.tsx` (rute noi)
- `src/components/ProtectedRoute.tsx` (rol nou)
- `src/hooks/useAuth.tsx` (tip `AppRole`)
- `src/pages/Login.tsx` (redirect)
- `src/pages/admin/UsersPage.tsx`, `CredentialsPage.tsx` (rol selectabil)
- `supabase/functions/admin-manage-users/index.ts` (validare rol)
- Toate paginile listă/detaliu eveniment (badge CSE): `EventsCalendar.tsx`, `StudentDashboard.tsx`, `StudentEventsPage.tsx`, `StudentEventDetailPage.tsx`, `ProfEventsPage.tsx`, `ProfEventDetailPage.tsx`, `TeacherDashboard.tsx`, `TeacherReportsPage.tsx`, `admin/EventsPage.tsx`, `admin/EventDetailPage.tsx`, paginile manager relevante, `coordinator/EventParticipantsPage.tsx`, `public/PublicEventsPage.tsx`.

---

## Întrebare de clarificare

CSE poate **publica** evenimente direct (status `published`) sau toate evenimentele lui necesită aprobare admin înainte de a fi vizibile elevilor? Implicit voi presupune că CSE poate publica direct (la fel ca un profesor).  
CSE Poate publica, la fel ca profesorul, dar in lista de prezenta si pdf si in aplicatia sa apara si clasa exacta din care fac parte elevii