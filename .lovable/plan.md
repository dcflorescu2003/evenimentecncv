## 1. Extindere `EventsCalendar` cu Proiecte de voluntariat

Generalizez `src/components/student/EventsCalendar.tsx` să accepte și „itemi" de tip volunteer day pe lângă evenimente:

- Nouă prop `volunteerDays?: VolunteerDayItem[]` cu `{ id, project_id, project_name, date, start_time, end_time, location, status }` și opțional `myEnrollment: boolean`.
- Combin internă: un singur `itemsByDate` cu discriminator `kind: "event" | "volunteer"`.
- În **lună**: pe lângă bulina existentă, dacă ziua are voluntariat → adaug litera **V** mică (badge text `V` în loc/peste bulină) folosind o nuanță secundară (ex. `bg-secondary text-secondary-foreground`).
- În **săptămână** și **zi**: cardul pentru voluntariat afișează un prefix `V` (badge mic) + numele proiectului + interval orar; click → navighează la pagina read-only a proiectului (vezi §3).
- Status afișat:
  - `enrolled` → verde (similar „Rezervat").
  - viitor & eligibil → primary.
  - trecut → estompat (vezi §2).

## 2. Evenimente/zile trecute afișate „mai șters"

În prezent, evenimentele trecute sunt incluse doar dacă utilizatorul are rezervare/înrolare. Schimbări:

- **Sursă date**: scot filtrul implicit „doar viitoare" (în `StudentDashboard` și `AllEventsCalendarSection` query-ul deja aduce toate published; ok). Dar `calendarEvents` filtrează după eligibilitate — păstrez ca atare, doar îi reduc opacitatea în UI.
- Adaug clasă `opacity-50` (sau `text-muted-foreground` + `bg-muted/40`) pentru:
  - cardurile din week/day view când `status === "past_or_full"` și data < azi
  - bulinele month-view rămân `bg-muted-foreground/40`
  - itemii volunteer cu `date < today` → același tratament

Astfel toate evenimentele/zilele trecute sunt mereu vizibile dar discrete.

## 3. Pagină nouă read-only pentru detalii eveniment

Rută nouă: `/events/preview/:id` (accesibilă rolurilor `teacher`, `homeroom_teacher`, `coordinator_teacher`, `admin`, `manager`, `student` ca fallback).

Componentă nouă: `src/pages/shared/EventPreviewPage.tsx` — vizual identică cu `StudentEventDetailPage` (titlu, descriere, dată, interval, locație, clase eligibile, fereastră rezervare, locuri rămase, CSE badge, fișiere `form_template` dacă există), dar:
- Fără secțiunea „Rezervă loc" / `bookMutation` / `bookingConfirm`.
- Fără secțiunea de rezervare/anulare proprie.
- Buton „Înapoi" întors la `history.back()`.

Pentru voluntariat: rută `/volunteer-projects/preview/:id` cu o pagină simetrică (`VolunteerProjectPreviewPage`) care arată descriere, perioadă, zile programate (read-only) și echipa.

## 4. Routing & click handlers

- `AllEventsCalendarSection` (prof/diriginte): înlocuiesc dialogul actual cu `navigate("/events/preview/:id")` sau `volunteer-projects/preview/:id` în `onEventClick`.
- `StudentDashboard` calendar: click pe item volunteer → `/student/volunteer-projects/:id` existent (dacă există) sau `/volunteer-projects/preview/:id` ca fallback când nu e înrolat. Pentru evenimente păstrez `/student/events/:id`.

## 5. Sursă date voluntariat în dashboarduri

- Hook nou `useCalendarVolunteerDays(role, userId, classId, grade)` în `src/hooks/`:
  - SELECT `volunteer_days` JOIN `volunteer_projects` unde `status='active'` și (eligibil pentru elev / fără restricție pentru profesori).
  - Pentru elev: include și zile unde există `volunteer_enrollments` activ (similar logicii event).
- Folosit în `StudentDashboard` și `AllEventsCalendarSection`.

## 6. Detalii tehnice

- Niciun schema change. RLS existent pe `volunteer_projects` (active) și `volunteer_days` (creator/coordinator/admin) — pentru elevi va trebui o policy nouă „read days of active projects" dacă nu există deja; verific la implementare și adaug doar dacă lipsește.
- Badge „V": componentă inline `<span className="inline-flex h-4 w-4 items-center justify-center rounded-sm bg-secondary text-secondary-foreground text-[9px] font-bold">V</span>`.
- Tipuri: extind `Props` din `EventsCalendar` fără a sparge call site-urile existente (`volunteerDays` opțional, default `[]`).
