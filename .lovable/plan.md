

## Plan: Generate Attendance PDF from Admin Event Participants Tab

### What it does
Adds a "Descarcă PDF prezență" button in the Participants tab of the admin event detail page. The generated PDF contains a simplified attendance table with columns: Nr., Clasa, Nume si Prenume, Status.

Status mapping:
- `present` / `late` → "Prezent"
- `excused` → "Absent motivat"  
- `absent` / `reserved` / no ticket → "Absent"

Public participants (visitors) are excluded from this PDF since they don't have a class.

### Changes

**1. `src/pages/admin/EventDetailPage.tsx`**
- Add a new query to fetch `student_class_assignments` + `classes` for all student participants, to get each student's class `display_name`
- Add a "Descarcă PDF prezență" button in the participants tab header
- On click, build the participant rows with class info and simplified status, then call a new PDF export function
- Sort rows by class name, then by student last name

**2. `src/lib/attendance-pdf.ts`**
- Add a new exported function `exportSimpleAttendancePdf` with the simplified format:
  - Header: title, date, time, location
  - Stats: Total, Prezenti, Absenti motivat, Absenti
  - Table columns: Nr., Clasa, Nume si Prenume, Status
  - Rows sorted by class then name (passed pre-sorted)

No database changes needed — all data (classes, assignments) is already available via existing tables and RLS policies.

