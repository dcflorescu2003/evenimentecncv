# Modulul „Orar & Meniu" — Etapa 1: elevi

Implementare orar pe clasă (vizibil elevilor) + meniu cantină preluat automat din API extern. Profesorii (orar individual) și sălile rămân pentru etape ulterioare.

## A. Bază de date

Migrație nouă cu 2 tabele:

`**class_schedules**` — un orar per clasă per an academic

- `class_id` → `classes.id`
- `academic_year` (text, ex: `2025-2026`)
- `notes` (text, opțional)
- UNIQUE(`class_id`, `academic_year`)

`**schedule_entries**` — sloturi individuale

- `schedule_id` → `class_schedules.id` ON DELETE CASCADE
- `day_of_week` (int 1-5, Luni-Vineri)
- `period` (int 1-8, ora din zi)
- `subject` (text)
- `teacher_name` (text, opțional — text liber acum; legare cu `profiles` rămâne pentru viitor)
- `room` (text, opțional)
- UNIQUE(`schedule_id`, `day_of_week`, `period`)

**RLS**:

- Admin: ALL
- Authenticated read: `true` (orice user autentificat citește orice orar — util pentru profesori să-și vadă propriile ore mai târziu; pentru elev vom filtra în UI după clasa lui)

**Intervale ore — hardcodate** în `src/lib/schedule-periods.ts`:

```ts
export const PERIODS = [
  { period: 1, start: "08:00", end: "08:50" },
  { period: 2, start: "09:00", end: "09:50" },
  // … până la 8
];
```

Vom confirma intervalele reale CNCV înainte de finalizare (placeholder: pauze de 10 min, 8 ore).

## B. Edge function meniu cantină

`supabase/functions/get-cantina-menu/index.ts`:

- GET către `https://flashcantemir.onrender.com/api/menu`
- Cache simplu in-memory în edge runtime (10 min TTL) — pentru cache mai robust folosim un singur rând în tabel nou `cantina_menu_cache (id=1, payload jsonb, fetched_at timestamptz)` cu RLS doar service_role.
- Răspuns: array filtrat/sortat după dată + `dish_type` (fel1 înainte de fel2).
- Verifică JWT (orice user autentificat poate apela), CORS standard.

## C. Module registry (minim viabil)

Nu implementăm acum hub-ul `/app` complet — îl ținem pentru un task separat. Adăugăm doar:

- Rută nouă `/student/orar` în `App.tsx` sub `StudentLayout`.
- Item nou în navbar-ul `StudentLayout` ("Orar & Meniu", icon `CalendarRange`).

(Când vom face hub-ul `/app`, modulul Orar e deja gata să fie listat acolo.)

## D. Pagina elev: `src/pages/student/StudentSchedulePage.tsx`

Layout:

1. **Header**: numele clasei elevului (din `student_class_assignments` → `classes.display_name`).
2. **Tabel orar** — desktop: coloane Zi×Oră (Luni-Vineri) × periods 1-8, fiecare celulă afișează materie / profesor / sală. Mobile: tabs pe zi cu listă verticală de ore.
3. **Indicator „acum"**: highlight pe slotul curent (calcul din `new Date()` + `PERIODS`).
4. **Secțiune Meniu cantină** sub orar — grupat pe dată (azi, mâine, restul săptămânii), separat fel1/fel2.

Loading: skeleton. Empty state: „Clasa ta nu are încă orar setat" / „Meniul nu este disponibil".

## E. Admin: management orar

Rută nouă `/admin/schedules` + item în `AdminLayout`:

- Listă clase cu badge „Are orar / Nu are orar".
- Click pe clasă → editor grilă 8×5 (period × day) cu input inline (subject, teacher_name, room) + buton **Salvează**.
- Buton **Import CSV** (deasupra grilei): upload fișier cu header `day,period,subject,teacher_name,room`. Validare + preview înainte de salvare. Înlocuiește integral orarul clasei.
- Format CSV documentat lângă buton.

## F. Fișiere

**Create**:

- migrație: 2 tabele + RLS
- `supabase/functions/get-cantina-menu/index.ts`
- `src/lib/schedule-periods.ts`
- `src/pages/student/StudentSchedulePage.tsx`
- `src/pages/admin/SchedulesPage.tsx`
- `src/components/schedule/ScheduleGridEditor.tsx`
- `src/components/schedule/CantinaMenuSection.tsx`

**Modificate**:

- `src/App.tsx` — 2 rute noi
- `src/components/layouts/StudentLayout.tsx` — item navbar
- `src/components/layouts/AdminLayout.tsx` — item navbar
- `mem://architecture/modules-plan` — notez că Orar (varianta elev) e implementată

## Întrebări înainte de implementare

1. **Intervale ore CNCV**: care sunt orele exacte (start-end ale fiecărei perioade 1-8)? Dacă nu le ai la îndemână, folosesc placeholder 08:00→16:00 cu sloturi de 50 min + pauze 10 min și vei ajusta în `schedule-periods.ts`.
2. **Sâmbătă**: au cursuri sâmbăta sau strict L-V?
3. **Câte ore maxim pe zi**: 8 e suficient sau e nevoie de mai mult (ex. 9-10 pentru profil seral)?  
1) Intervalul ore este 07:30 - 8:20, ultima ora este la 19:20  
2)L-V  
In orar o sa vreau sa avem si materia, sala si profesorul 