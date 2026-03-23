

## Plan: Auto-select session + New homeroom teacher reports

### 1. Auto-select the most recent/active session

**Problem**: In `TeacherDashboard`, `TeacherReportsPage`, and `ReportsPage` (admin), `sessionId` starts as `""`, forcing users to manually pick a session every time.

**Solution**: Add a `useEffect` that sets `sessionId` to the active session (or most recent) once `sessions` data loads. Apply to:
- `src/pages/teacher/TeacherDashboard.tsx`
- `src/pages/teacher/TeacherReportsPage.tsx`
- `src/pages/admin/ReportsPage.tsx`

Logic: find session with `status === "active"`, fallback to first in list (already sorted by `start_date desc`).

---

### 2. Two new homeroom teacher report views

Add two new report tabs/sections to the teacher reports page (`TeacherReportsPage.tsx`):

**Report A — "Situație elevi" (Student overview)**
A matrix/table showing each student with:
- Columns: Student name | Event 1 | Event 2 | ... | Total ore validate
- Cell values: ✓ (present/late), ✗ (absent), — (not enrolled)
- Gives an "at a glance" view of who did what across all session events
- Exportable to PDF

**Report B — "Verificare prezență" (Attendance check)**
- Filter by: a specific date OR a specific event
- Shows only students from the homeroom class
- Columns: Student name | Event title | Status (Prezent / Absent / Neînscris)
- Quick way to check "who from my class was at event X" or "what happened on date Y"
- Exportable to PDF

**Implementation**: Use Tabs component within `TeacherReportsPage.tsx` with three tabs:
1. "Sumar" (existing report)
2. "Situație elevi" (new Report A)
3. "Verificare prezență" (new Report B)

### Files to modify
- `src/pages/teacher/TeacherDashboard.tsx` — auto-select session
- `src/pages/teacher/TeacherReportsPage.tsx` — auto-select session + add 2 new report tabs
- `src/pages/admin/ReportsPage.tsx` — auto-select session

### Technical notes
- Report A queries: events for session → reservations for class students → tickets for status → build matrix
- Report B queries: events filtered by date or single event → reservations + tickets for class students
- Both use existing batch-fetch patterns for large datasets
- PDF export via existing `exportReportPdf` utility

