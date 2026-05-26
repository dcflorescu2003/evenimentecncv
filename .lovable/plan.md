## Obiectiv
Admin gestionează o listă de materii și atribuie 1+ materii fiecărui profesor.

## Bază de date (migrare)

1. **`subjects`** — listă materii
   - `id uuid pk`, `name text unique not null`, `short_name text` (opțional, pt. abrevieri tip aSc), `is_active boolean default true`, `created_at`, `updated_at`
   - RLS: `authenticated` read; doar `admin` insert/update/delete
   - Seed inițial: extragere `DISTINCT subject` din `schedule_entries` + din `SUBJECT_ALIASES` (denumiri complete)

2. **`teacher_subjects`** — many-to-many profesor ↔ materie
   - `id uuid pk`, `teacher_id uuid` (referință profil), `subject_id uuid`, `created_at`
   - UNIQUE `(teacher_id, subject_id)`
   - RLS: `authenticated` read; doar `admin` manage
   - Profesorul își poate citi propriile materii (deja prin authenticated read)

## Pagini admin

3. **Nouă pagină `src/pages/admin/SubjectsPage.tsx`** (rută `/admin/subjects`)
   - Tabel materii cu căutare (sortat alfabetic RO)
   - Buton „Adaugă materie" (dialog: nume + short_name opțional)
   - Editare inline / dialog edit
   - Toggle activ / inactiv (soft delete) și ștergere reală dacă nu e folosită
   - Link adăugat în `AdminLayout` sidebar

4. **`UsersPage.tsx`** — la editarea unui utilizator cu rol profesor (`teacher`, `homeroom_teacher`, `coordinator_teacher`)
   - Câmp nou „Materii predate" — multi-select (Combobox cu căutare, suportă scalare)
   - Sincronizare via edge function `admin-manage-users` (acțiuni `create_user` / `update_user`): primește `subject_ids: string[]`, face delete + insert în `teacher_subjects`

## Edge function

5. **`supabase/functions/admin-manage-users/index.ts`**
   - Extinde `create_user` și `update_user` să accepte `subject_ids?: string[]`
   - După insert profile/roles: șterge `teacher_subjects` pentru `user_id` și inserează noile rânduri

## Cod existent — fără modificări funcționale
- Orarul (`StudentSchedulePage`, `resolveTeacherDisplay`) rămâne la fel: matching pe `initials` din `profiles`. Materiile în `schedule_entries` rămân text liber (mapate prin `SUBJECT_ALIASES`).
- Lista de materii e doar pentru evidența admin + atribuire profesor → materie (folosibilă ulterior în rapoarte/normă).

## Fișiere

- **Migrare nouă**: `subjects`, `teacher_subjects`, RLS, seed din existent
- **Nou**: `src/pages/admin/SubjectsPage.tsx`
- **Modificat**: `src/App.tsx` (rută), `src/components/layouts/AdminLayout.tsx` (meniu), `src/pages/admin/UsersPage.tsx` (multi-select materii), `supabase/functions/admin-manage-users/index.ts`

## De clarificat (opțional, pot decide implicit)
- Folosim **soft-delete** (`is_active`) ca default, cu opțiune de ștergere reală când materia nu e referențiată.
- `short_name` rămâne opțional, nu îl folosim încă în orar (poate fi etapa următoare pentru a înlocui hardcoded `SUBJECT_ALIASES`).