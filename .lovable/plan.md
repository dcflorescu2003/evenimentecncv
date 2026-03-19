

## Plan: Per-Event Student Assistants

### What it does
Allows admins (and teachers) to assign students as "Asistenți" for a specific event. These students:
- Are linked to the event temporarily (not a permanent role)
- Appear in the participants list marked as "Asistent" with status "Prezent"
- Appear in the attendance PDF as "Prezent"

### Database Changes

**New table: `event_student_assistants`**
- `id` (uuid, PK)
- `event_id` (uuid, NOT NULL)
- `student_id` (uuid, NOT NULL)
- `created_at` (timestamptz, default now())
- `assigned_by` (uuid, NOT NULL)
- Unique constraint on (event_id, student_id)

**RLS policies:**
- Admins: full access
- Teachers/homeroom teachers: manage for own events (using `is_event_creator`)
- Coordinators: read for assigned events
- Students: read own assignments

### UI Changes

**`src/pages/admin/EventDetailPage.tsx`**
- Add a query to fetch `event_student_assistants` with joined profile data
- In the Participants tab, show student assistants as additional rows with badge "Asistent" and status "Prezent"
- Add a button "Adaugă elev asistent" that opens a dialog to search/select students
- Include student assistants in the PDF export as "Prezent"

**Dialog for adding student assistants:**
- Search field to filter students by name
- Query all students (profiles with student role) excluding those already participants or assistants
- Select and assign

### How it works
- Student assistants are separate from reservations — they don't consume capacity
- In the participants table, they appear with a distinct "Asistent" badge
- In the PDF, they appear as "Prezent" with their class info
- Removing an assistant just deletes the row from `event_student_assistants`

