
## Plan: Optimizare mobil (Admin/Manager) + Fix coordonator pentru profesori

### Partea 1 — Optimizare mobil pentru Admin & Manager

**Problemă**: Tabelele și paginile din admin/manager nu sunt responsive pe ecrane mici (overflow orizontal, butoane prea mari, filtre nestackate).

**Soluție**: Pattern unificat — tabel pe desktop (`md+`), card-list pe mobil (`< md`).

#### Pagini Admin de optimizat:
1. `src/pages/admin/UsersPage.tsx` — tabel utilizatori → card-list pe mobil cu acțiuni în dropdown
2. `src/pages/admin/EventsPage.tsx` — tabel evenimente → card-list pe mobil
3. `src/pages/admin/EventDetailPage.tsx` — taburi (participanți, asistenți, fișiere) → scroll orizontal pe mobil + carduri
4. `src/pages/admin/SessionsPage.tsx` — tabel sesiuni → card-list
5. `src/pages/admin/ClassesPage.tsx` — tabel clase → card-list
6. `src/pages/admin/CredentialsPage.tsx` — filtre stacked vertical pe mobil
7. `src/pages/admin/ImportPage.tsx` — verificare padding/butoane
8. `src/pages/admin/ReportsPage.tsx` — selector sesiune full-width pe mobil
9. `src/pages/admin/AuditPage.tsx` — tabel audit → card-list pe mobil
10. `src/pages/admin/AdminDashboard.tsx` — grid `sm:grid-cols-2 lg:grid-cols-4` (deja OK, verific)

#### Pagini Manager de optimizat:
11. `src/pages/manager/ManagerDashboard.tsx` — verificat (grid OK)
12. `src/pages/manager/EventReportPage.tsx` — tabel → card-list pe mobil
13. `src/pages/manager/ClassReportPage.tsx` — matrice → scroll orizontal cu sticky first column
14. `src/pages/manager/StudentReportPage.tsx` — tabel → card-list
15. `src/pages/manager/TeacherReportPage.tsx` — tabel → card-list
16. `src/pages/manager/SessionReportPage.tsx` — agregate → grid responsive
17. `src/pages/manager/DayReportPage.tsx` — tabel → card-list
18. `src/pages/manager/IncompleteNormPage.tsx` — tabel → card-list

#### Layouts:
19. `src/components/layouts/AdminLayout.tsx` & `ManagerLayout.tsx` — verificare hamburger/sidebar pe mobil (dacă nu e deja OK)

**Pattern aplicat (exemplu)**:
```tsx
{/* Desktop */}
<div className="hidden md:block">
  <Table>...</Table>
</div>
{/* Mobile */}
<div className="md:hidden space-y-2">
  {items.map(item => (
    <Card key={item.id}>
      <CardContent className="p-3 space-y-1">
        <div className="flex justify-between">
          <p className="font-medium">{item.name}</p>
          <DropdownMenu>...</DropdownMenu>
        </div>
        <p className="text-xs text-muted-foreground">{item.subtitle}</p>
      </CardContent>
    </Card>
  ))}
</div>
```

Filtre/search bars: `flex flex-col sm:flex-row gap-2`, butoane `w-full sm:w-auto`.

---

### Partea 2 — Fix evenimente coordonate pentru rolul `teacher`

**Problemă identificată în `src/pages/prof/ProfDashboard.tsx`**:
- Query `prof_coord_assignments` filtrează `coordinator_assignments` după `teacher_id = user.id` ✅ (corect)
- DAR: secțiunea „Evenimente de coordonat" filtrează `activeAssigned = assignments.filter(a => a.events?.status === "published")` — **exclude evenimente `closed`**, deci profesorul nu vede istoric coordonare.
- Statistica „Ore totale (coordonare)" folosește `assignments.reduce(...)` din toate assignments (inclusiv closed) ✅
- Statistica „Evenimente coordonate" folosește `assignments.length` ✅

**Verificare suplimentară**:
- Trebuie să verific că `ProfEventsPage.tsx` listează **și** evenimentele coordonate, nu doar cele create. Voi citi fișierul în implementare.
- Verific și `useCapacitorPush` / layout — nu e necesar.

#### Modificări `ProfDashboard.tsx`:
1. **Separare** evenimente coordonate în două secțiuni:
   - „Evenimente de coordonat (active)" — `status = published` (cu butoane Scan/Participanți)
   - „Istoric coordonare" — `status = closed` sau dată trecută (read-only, link spre detalii)
2. **Recalculare ore corecte**: includem `counted_duration_hours` doar pentru evenimente unde data ≤ azi SAU status = closed (eveniment efectiv desfășurat). Filtrăm draft-urile.
3. **Norma**: în query `prof_norm`, deja filtrăm pe `events.session_id` — corect. Verific că folosește `counted_duration_hours` corect (deja face).

#### Modificări `ProfEventsPage.tsx`:
- Adaug tab/secțiune „Coordonate de mine" (alături de „Create de mine") — listă din `coordinator_assignments` cu join pe `events`.
- Sortare descrescătoare după dată.

**Validare cu DB**: Înainte de a modifica, verific cu un SELECT că există într-adevăr profesori (`role = 'teacher'`) cu `coordinator_assignments` și că `events.counted_duration_hours` e populat.

---

### Fișiere modificate/create

**Partea 1 (mobil)** — ~15 fișiere admin/manager (vezi listă mai sus).

**Partea 2 (coordonator profesori)**:
- `src/pages/prof/ProfDashboard.tsx` — secțiuni separate active/istoric, recalcul ore
- `src/pages/prof/ProfEventsPage.tsx` — adăugare secțiune „Coordonate"

### Ce NU se schimbă
- Schema DB, RLS, edge functions (politicile actuale permit deja `teacher` să citească `coordinator_assignments` proprii și `events` aferente).
- Logica de business (rotunjire ore, validare prezență).
- Conturile elev/coordinator_teacher/diriginte.

### Întrebare opțională
Pentru tabelele foarte largi din manager (ex. `ClassReportPage` matrice elev × eveniment), preferi:
- **A)** Card-list pe mobil (pierdem vederea matricială, dar e citibil)
- **B)** Scroll orizontal cu prima coloană sticky (păstrăm matricea, swipe horizontal)

Recomand **B** pentru rapoartele matriciale și **A** pentru tabelele simple. Aplic această strategie dacă nu spui altfel.
