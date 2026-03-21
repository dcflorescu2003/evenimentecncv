

## Plan: Implementare Rol Manager (Supervizor) cu 6 Rapoarte

### Rezumat

Se adauga rolul `manager` in sistem cu acces complet read-only. Managerul va avea un dashboard dedicat (`/manager`) cu 6 tipuri de rapoarte interconectate, toate cu export PDF.

---

### 1. Migrare baza de date

**O singura migrare SQL care:**
- Adauga `manager` la enum-ul `app_role`
- Adauga politici RLS de tip SELECT pe toate tabelele relevante pentru `has_role(auth.uid(), 'manager')`:
  - `events`, `reservations`, `tickets`, `profiles`, `classes`, `student_class_assignments`, `coordinator_assignments`, `event_student_assistants`, `attendance_log`, `program_sessions`, `class_participation_rules`, `public_reservations`, `public_tickets`, `user_roles`

### 2. Actualizare cod autentificare si rutare

| Fisier | Modificare |
|--------|-----------|
| `src/hooks/useAuth.tsx` | Adaug `manager` la tipul `AppRole` |
| `src/components/ProtectedRoute.tsx` | Adaug `manager` la tip + redirect catre `/manager` |
| `src/App.tsx` | Adaug rutele `/manager/*` cu `ManagerLayout` si cele 6 pagini |
| `src/pages/admin/UsersPage.tsx` | Adaug `manager: "Manager"` in `roleLabels` |

### 3. Layout Manager (fisier nou)

**`src/components/layouts/ManagerLayout.tsx`**
- Sidebar cu 6 intrari: Sesiune, Evenimente, Zile, Clase, Elevi, Profesori
- Doar buton logout, fara actiuni de scriere
- Pattern identic cu `AdminLayout`

### 4. Cele 6 pagini de rapoarte (fisiere noi)

**4.1 `src/pages/manager/SessionReportPage.tsx`** — Raport pe sesiune
- Selector sesiune
- Tabel cu toate evenimentele grupate pe zile: data, interval orar, titlu, profesori coordonatori
- Export PDF landscape

**4.2 `src/pages/manager/EventReportPage.tsx`** — Raport pe eveniment (lista de prezenta)
- Selector sesiune + selector eveniment
- Tabel: elev, clasa, status (Prezent/Absent/Absent motivat)
- Sectiune separata: asistenti elevi + profesori coordonatori
- Click pe elev → navigare la `/manager/students?id=...`
- Export PDF

**4.3 `src/pages/manager/DayReportPage.tsx`** — Raport pe zile
- Date picker pentru selectare zi
- Lista evenimente din ziua respectiva: titlu, ora, profesori, numar elevi inscrisi
- Export PDF

**4.4 `src/pages/manager/ClassReportPage.tsx`** — Raport pe clase
- Search/dropdown clasa
- Activitatea clasei: evenimente, elevi inscrisi vs. neinscrisi
- Click pe elev → raport detaliat
- Export PDF

**4.5 `src/pages/manager/StudentReportPage.tsx`** — Raport per elev
- Search field pentru cautare elev (toate clasele)
- Fisa elevului: evenimente rezervate, prezente, ore validate, ore ramase
- Accepta parametru URL `?id=...` pentru navigare din alte rapoarte
- Export PDF

**4.6 `src/pages/manager/TeacherReportPage.tsx`** — Raport pe profesor
- Lista profesori cu sumar: ore totale, nr evenimente
- Click pe profesor → detalii: lista evenimente, participanti
- Search dupa profesor
- Export PDF

### 5. Interconectare

- In orice tabel cu elevi, numele este link clickable → `/manager/students?id=<uuid>`
- In orice tabel cu profesori, numele este link clickable → `/manager/teachers?id=<uuid>`
- Pattern consistent in toate cele 6 rapoarte

### Fisiere afectate

| Tip | Fisiere |
|-----|---------|
| Noi (8) | `ManagerLayout.tsx`, `SessionReportPage.tsx`, `EventReportPage.tsx`, `DayReportPage.tsx`, `ClassReportPage.tsx`, `StudentReportPage.tsx`, `TeacherReportPage.tsx`, migrare SQL |
| Editate (4) | `useAuth.tsx`, `ProtectedRoute.tsx`, `App.tsx`, `UsersPage.tsx` |

