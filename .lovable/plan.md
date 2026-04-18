
## Plan: Fix KPI elevi/profesori + click pe „Evenimente săptămâna aceasta"

### Problemă identificată
În `src/pages/admin/AdminDashboard.tsx`:
1. `supabase.from("profiles").select("id, is_active")` returnează doar 1000 rânduri (limita PostgREST), iar valoarea afișată „Elevi activi" numără orice profil activ — nu doar elevi.
2. Cardul „Evenimente săptămâna aceasta" nu este clickabil.

### Modificări — un singur fișier: `src/pages/admin/AdminDashboard.tsx`

1. **Înlocuiesc query-ul `profiles`** cu două count-uri exacte prin `user_roles` join cu `profiles`:
   - Elevi activi: `user_roles` cu `role='student'` ∩ `profiles.is_active=true` (DISTINCT user_id)
   - Profesori activi: `user_roles` cu `role IN ('teacher','homeroom_teacher','coordinator_teacher')` ∩ `profiles.is_active=true` (DISTINCT user_id)
   - Folosesc pattern-ul de batching pe ID-uri (memoria `tech/database-constraints` & `ui-query-pattern`) pentru a evita limita 1000: fetch IDs din `user_roles` per rol → fetch `profiles.is_active` în chunk-uri de 1000 → numărare distinctă.

2. **Schimb grila KPI** la 5 carduri pe lg (`lg:grid-cols-5`) sau păstrez `lg:grid-cols-4` și pun „Profesori activi" pe rând nou. Aleg `lg:grid-cols-4` cu un al 5-lea card care wrapează (mai curat). Folosesc icon `GraduationCap` pentru profesori și `Users` pentru elevi.

3. **Cardul „Evenimente săptămâna aceasta"** → wrap în element clickabil cu `onClick={() => navigate("/admin/events")}` + clase `cursor-pointer hover:shadow-md transition-shadow`. Folosesc `useNavigate` din `react-router-dom`.

### KPI final (5 carduri):
- Sesiuni active
- Evenimente publicate
- **Elevi activi** (count corect)
- **Profesori activi** (NOU)
- Rezervări active

### Ce NU se schimbă
- Schema DB, RLS, alte pagini.
- Logica chart-urilor pie/bar.
- Cardul „Capacitate aproape plină" (rămâne neclickabil, are deja listă inline).
