## Obiectiv

Bottom nav-ul elevului devine specific modulului curent, iar comutarea între module se face dintr-un dropdown în header (în locul butonului care duce la `/app`).

## Modificări

### 1. `src/components/ModuleSwitcher.tsx` (nou)
Înlocuiește `ModulesButton` în header. Dropdown (shadcn `DropdownMenu`) care:
- afișează iconiță `LayoutGrid` + label scurt cu numele modulului curent
- listează toate modulele activate pentru rolurile userului (din `getEnabledModules`)
- marchează modulul curent (check)
- la click navighează direct la path-ul modulului (fără a mai trece prin `/app`)
- păstrează intrare „Toate modulele” → `/app` (opțional, pentru hub-ul de carduri)

### 2. `src/components/layouts/StudentLayout.tsx`
- Detectează modulul curent din `location.pathname`:
  - `schedule` dacă path-ul începe cu `/student/orar`
  - `events` altfel
- Două seturi de `navItems`:
  - **Evenimente**: Panou (`/student`), Evenimente (`/student/events`), Bilete (`/student/tickets`)  — fără Orar
  - **Orar & Meniu**: Orar (`/student/orar`) — fără cele 3 butoane de evenimente
- În header înlocuiește `<ModulesButton />` cu `<ModuleSwitcher />`.

Bottom nav-ul cu un singur item (Orar) e ok vizual; dacă vrei mai târziu împărțim pagina în „Orar” și „Meniu cantină” ca rute separate.

### 3. Restul layout-urilor (`AdminLayout`, `CoordinatorLayout`, `ManagerLayout`, `ProfLayout`, `TeacherLayout`)
Înlocuim `ModulesButton` cu `ModuleSwitcher` în header pentru consistență (acelea n-au bottom nav, deci nu se schimbă altceva).

## Ce NU se atinge
- `src/modules/registry.ts` rămâne neschimbat.
- `/app` (AppHub-ul cu carduri) rămâne ca pagină accesibilă, dar nu mai e ecranul implicit de comutare.
- Logica paginilor (Orar, Evenimente, Bilete) nu se modifică.
