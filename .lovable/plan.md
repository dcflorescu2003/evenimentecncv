
# Plan: Modul „Cluburi & Voluntariat"

Notă: Feedback rămâne pe etapa următoare. Acum livrăm doar Cluburi + Voluntariat, ca un singur modul nou în registry (`/app` → „Cluburi & Voluntariat"), cu dashboard care arată întâi proiectele de voluntariat active și dedesubt cluburile.

---

## 1. Structură date (Supabase)

### Tabele noi

**`clubs`** — definiția clubului
- `name`, `description`, `frequency_label` (text liber: „Săptămânal Joi 15:00")
- `session_id` (academic year scope), `max_capacity`, `eligible_grades int[]`, `eligible_classes uuid[]`
- `enrollment_open_at`, `enrollment_close_at` (modificabile oricând)
- `status` enum: `draft | active | archived`
- `created_by`, timestamps

**`club_coordinators`** — mai mulți coordonatori per club (profesori și/sau elevi), toți cu aceleași drepturi de management (prezență, vezi membri, rapoarte). Unique `(club_id, user_id)`.

**`club_enrollments`** — înscrieri elevi
- `club_id`, `student_id`, `status` (`enrolled | withdrawn`), `enrolled_at`, `withdrawn_at`
- Eligibilitate verificată prin RPC `check_club_enrollment` (capacitate + clasă/an + perioadă), similar `check_booking_eligibility`.

**`club_meetings`** — întâlniri ale clubului (echivalent unui „event day")
- `club_id`, `date`, `start_time`, `end_time`, `location`, `qr_code_data` (uuid), `status`
- Generate manual de coordonator sau bulk din frecvență (opțional, etapa 2).

**`club_attendance`** — prezența per întâlnire
- `meeting_id`, `student_id`, `status` (`present | late | absent`), `checkin_at`, `marked_by`
- Reuse fereastra `-30m / +15m` din regulile existente (validare în RPC).

### Voluntariat (proiecte multi-zi)

**`volunteer_projects`** — proiect cu perioadă fixă
- `name`, `description`, `session_id`, `location`
- `start_date`, `end_date` (perioada proiectului, dincolo de care nu se mai pot face prezențe)
- `enrollment_open_at`, `enrollment_close_at`
- `max_capacity`, `eligible_grades`, `eligible_classes`, `max_per_class`
- `status`: `draft | active | closed` (auto-closed via pg_cron după `end_date`, ca la `close-past-events`)
- `created_by`

**`volunteer_coordinators`** — mai mulți coordonatori (profesori/elevi).

**`volunteer_enrollments`** — înscrieri elevi (analog `club_enrollments`).

**`volunteer_days`** — zilele active ale proiectului
- `project_id`, `date`, `start_time`, `end_time`, `qr_code_data`
- Coordonatorul adaugă zilele relevante (nu obligatoriu toate datele din interval).

**`volunteer_attendance`** — `project_day_id`, `student_id`, `status`, `checkin_at`, `marked_by`.

### Grants & RLS (rezumat)

- `GRANT SELECT, INSERT, UPDATE, DELETE` pentru `authenticated`; `GRANT ALL` pentru `service_role`.
- `SECURITY DEFINER` helpers:
  - `is_club_coordinator(_user, _club)`, `is_club_enrolled(_user, _club)`
  - `is_volunteer_coordinator(_user, _project)`, `is_volunteer_enrolled(_user, _project)`
- RLS:
  - Admin & CSE: full (CSE pentru cluburile/proiectele unde e `created_by` sau coordonator).
  - Coordonatori (profesor sau elev): citesc & gestionează clubul/proiectul propriu (membri, meetings, attendance).
  - Elev: vede toate cluburile/proiectele `active`; vede & se înscrie/retrage doar pentru sine; vede propria prezență.
  - Manager: read-only global (similar tabelelor existente).

### Funcții & cron

- `check_club_enrollment(student, club)` — capacitate, perioadă, eligibilitate clasă/an, evită dubla înscriere, max_per_class (opțional).
- `check_volunteer_enrollment(student, project)` — analog.
- `get_club_attendance_stats(club_id, student_id?)` — pentru rapoarte.
- `pg_cron` zilnic 06:00 — închide `volunteer_projects` cu `end_date < today`.

---

## 2. UI

### Module registry
Adaug în `src/modules/registry.ts` modulul `clubs_volunteer`:
- Label: „Cluburi & Voluntariat"
- Icon: `Users` (lucide)
- Paths per rol: admin → `/admin/clubs`, cse → `/cse/clubs`, student → `/student/clubs`, teacher → `/teacher/clubs`, manager → `/manager/clubs`.

### Dashboard modul (toți utilizatorii)
`/student/clubs`, `/cse/clubs`, etc. — același layout:
1. „Voluntariat activ" — carduri cu proiecte `active`, perioada și nr. locuri.
2. „Cluburi" — carduri cu clubul, coordonatori, locuri rămase, perioada de înscriere.

### Pagini per tip

**Cluburi**
- `ClubsListPage` (admin/CSE): tabel cu acțiuni → creare/editare club, definește coordonatori, vezi membri, vezi rapoarte.
- `ClubDetailPage`:
  - Tab „General" (nume, descriere, frecvență, perioadă înscriere — editabile).
  - Tab „Coordonatori" (add/remove profesori/elevi cu Combobox).
  - Tab „Membri" (listă înscriși, sortată după `last_name`; admin/coordonator pot retrage forțat).
  - Tab „Întâlniri" (listă + buton „Creează întâlnire" → generează QR; per întâlnire → ecran prezență cu listă + scan QR, fereastră -30/+15 min).
  - Tab „Rapoarte" (matrice prezență elev × întâlnire).
- `StudentClubsPage`: listă cluburi cu „Înscrie-mă" / „Retrage-mă"; ecran „Clubul meu" cu calendarul întâlnirilor și prezența proprie. Înscrierile sunt libere dacă elevul îndeplinește filtrele și e perioada deschisă (fără aprobare manuală — am ales „Capacitate + filtre").

**Voluntariat**
- `VolunteerProjectsPage` (admin/CSE): tabel proiecte + creare/editare.
- `VolunteerProjectDetailPage`:
  - Tab „General" (date, perioadă, înscrieri).
  - Tab „Coordonatori".
  - Tab „Înscriși".
  - Tab „Zile & prezență" (admin/coordonator adaugă zilele; per zi → QR + listă prezență, aceeași logică -30/+15).
  - Tab „Rapoarte".
- `StudentVolunteerPage`: listă active + „Înscrie-mă / Retrage-mă"; istoric prezență per proiect.

**Scan QR**
- Refolosesc componentele existente din `*/scan/*` într-o variantă `ClubScanPage` și `VolunteerScanPage` care primesc `meeting_id` / `day_id`.

### Rapoarte admin (`/admin/reports`)

Adaug subsecțiuni noi:
- **Pe club** — listă cluburi → detaliu cu rate prezență, total întâlniri, membri activi, export CSV/PDF.
- **Pe proiect de voluntariat** — analog (ore/zile prezent, % participare).
- **Pe clasă** — pivot: elevii clasei × (cluburi înscris/ore prezent + proiecte voluntariat ore prezent), pe sesiune.
- **Pe elev** — fișa elev: lista cluburilor și proiectelor cu prezență detaliată.
- Reutilizez `lib/report-pdf.ts` și pattern-urile din `ManagerReports`.

---

## 3. Etapizare livrare

1. **Schema DB + RLS + grants** (migration unic) pentru cluburi & voluntariat + funcții helper.
2. **Modul în registry + dashboard** + rute admin/CSE/student.
3. **CRUD cluburi** (definire, coordonatori, înscrieri, întâlniri, prezență cu QR).
4. **CRUD voluntariat** (analog, cu zile + auto-close cron).
5. **Rapoarte admin** (club, proiect, clasă, elev) + export CSV/PDF.
6. **Memory update**: adaug `mem://features/clubs-volunteer` și actualizez `mem://index.md`.

---

## Detalii tehnice cheie

- Coordonatori multipli: toți (profesor sau elev) au aceleași drepturi de management — verificat prin `is_club_coordinator` / `is_volunteer_coordinator` în RLS.
- Prezență identică cu evenimentele: QR + listă, fereastră -30m/+15m → după aceea `late`, restul `absent`.
- Înscrieri: capacitate + filtre clasă/an + perioadă; fără aprobare manuală.
- Voluntariatul **nu** se amestecă cu `events`; e tabel separat, dar trăiește în același modul UI ca și cluburile.
- Toate textele în română, datele `zz.ll.aaaa`, orele HH:MM, sortare după `last_name`.
- Auto-close proiecte voluntariat prin extinderea cron-ului `close-past-events` sau job nou similar.

Confirmă planul și trec la implementarea etapei 1 (schema DB).
