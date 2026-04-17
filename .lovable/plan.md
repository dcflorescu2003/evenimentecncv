
## Plan: Afișare ore raportate la norma minimă

### Format
- **Ore rezervate**: `rezervate / required` (ex: `12 / 17`). Dacă nu există regulă → doar numărul.
- **Ore validate**: `validate / required` (ex: `8 / 17`). Dacă nu există regulă → doar numărul.

### Helper nou
`src/lib/hours-format.ts`:
```ts
export function formatHoursVsRequired(hours: number, required?: number | null): string {
  if (required && required > 0) return `${hours} / ${required}`;
  return `${hours}`;
}
```

### Pagini modificate

1. **`src/pages/manager/StudentReportPage.tsx`** — `requiredHours` deja disponibil. Aplic format pe cardurile „Ore rezervate" și „Ore validate" + în subtitlul PDF.

2. **`src/pages/manager/IncompleteNormPage.tsx`** — query-ul aduce deja `required_value` per clasă (e baza filtrului „normă incompletă"). Aplic format pe coloanele de ore + export PDF.

3. **`src/pages/teacher/TeacherReportsPage.tsx`** (secțiunea diriginte/matrice clasă) — clasa = clasa dirigintelui, deci `required_value` e cunoscut o singură dată. Aplic format pe celulele cu ore rezervate/validate per elev + în PDF.

4. **`src/pages/manager/SessionReportPage.tsx`** — verific dacă afișează ore agregate per elev; dacă da, aplic format (necesită fetch `class_participation_rules` per clasă a elevului).

5. **`src/pages/student/StudentDashboard.tsx`** — afișează propriul progres (ore rezervate/validate). Folosesc `get_student_progress` RPC care întoarce `required_hours`. Aplic format.

### Ce NU se schimbă
- RPC, queries de bază, RLS, schema DB.
- Coloane care arată o singură valoare fără context (durată eveniment etc.).

### Pași
1. Creez `src/lib/hours-format.ts`.
2. Refactor `StudentReportPage` (carduri + PDF subtitle).
3. Refactor `IncompleteNormPage` (tabel + PDF).
4. Refactor `TeacherReportsPage` matrice diriginte (tabel + PDF).
5. Verific & adapt `SessionReportPage` și `StudentDashboard`.
