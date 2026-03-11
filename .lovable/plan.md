

# Colegiul Național Cantemir Vodă — Platform de gestiune activități școlare

## Project Plan

An internal school platform for managing student participation in annual programs (Școala Altfel, Săptămâna Verde). Admins define sessions/events, import users via CSV, students book tickets within class hour limits, coordinators scan QR codes for attendance, and reports track completion.

---

## Database Schema

### Core Tables

**profiles** — extends Supabase auth.users
- id (FK → auth.users), first_name, last_name, username, display_name, student_identifier (nullable), email (nullable), is_active, created_at

**user_roles** — separate role table (admin/student/homeroom_teacher/coordinator_teacher)
- id, user_id (FK → auth.users), role (enum)

**classes**
- id, academic_year, grade_number, section (nullable for V–VIII), display_name, homeroom_teacher_id (FK → profiles), is_active

**student_class_assignments**
- id, student_id (FK → profiles), class_id (FK → classes), academic_year

**coordinator_assignments** — links coordinators to events
- id, teacher_id (FK → profiles), event_id (FK → events)

### Programs & Rules

**program_sessions**
- id, academic_year, name, start_date, end_date, status (draft/active/closed/archived)

**class_participation_rules**
- id, class_id, session_id, requirement_type (default 'hours'), required_value (integer), enforcement_mode, notes

### Events

**events**
- id, session_id, title, description, date, start_time, end_time, computed_duration_display, counted_duration_hours (integer, rounded), location, room_details, max_capacity, published, booking_open_at, booking_close_at, status (draft/published/closed/cancelled), eligible_grades (int[]), eligible_classes (uuid[]), notes_for_teachers

### Reservations & Tickets

**reservations**
- id, student_id, event_id, reservation_code (unique), status (reserved/cancelled), created_at, cancelled_at

**tickets**
- id, reservation_id, qr_code_data (unique), status (reserved/cancelled/present/late/absent/excused), checkin_timestamp

### Attendance

**attendance_log** (audit trail)
- id, ticket_id, previous_status, new_status, changed_by, changed_at, notes

### Files

**event_files** (dossier docs + form templates)
- id, event_id, title, description, file_name, file_type, file_category (event_dossier/form_template), uploaded_by, uploaded_at, is_required, notes, storage_path

**form_submissions**
- id, event_id, student_id, related_template_id (nullable, FK → event_files), form_title, file_name, file_type, uploaded_by, uploaded_at, status (uploaded/reviewed/accepted/rejected), admin_notes, storage_path

### Admin

**import_batches**
- id, imported_by, imported_at, file_name, row_count, success_count, error_count, status, summary_json

**audit_logs**
- id, user_id, action, entity_type, entity_id, details (jsonb), created_at

---

## Route Map

| Route | Page | Access |
|---|---|---|
| `/login` | Login | Public |
| `/admin` | Admin Dashboard | Admin |
| `/admin/sessions` | Program Sessions CRUD | Admin |
| `/admin/classes` | Classes & Rules | Admin |
| `/admin/import` | CSV Import | Admin |
| `/admin/events` | Events List | Admin |
| `/admin/events/:id` | Event Detail (docs, forms, participants) | Admin |
| `/admin/users` | User Management | Admin |
| `/admin/reports` | Reports Hub | Admin |
| `/admin/reports/class/:id` | Class Report | Admin |
| `/admin/reports/student/:id` | Student Report | Admin |
| `/admin/reports/event/:id` | Event Report | Admin |
| `/admin/audit` | Audit Log | Admin |
| `/student` | Student Dashboard (progress + tickets) | Student |
| `/student/events` | Browse & Book Events | Student |
| `/student/events/:id` | Event Detail (forms, book) | Student |
| `/student/tickets` | My Tickets | Student |
| `/teacher` | Homeroom Dashboard (class overview) | Homeroom |
| `/teacher/reports` | Class Reports + Export | Homeroom |
| `/coordinator` | Coordinator Dashboard | Coordinator |
| `/coordinator/scan/:eventId` | QR Scanner | Coordinator |
| `/coordinator/event/:eventId` | Event Participant List | Coordinator |

---

## Permissions Matrix

| Action | Admin | Student | Homeroom | Coordinator |
|---|---|---|---|---|
| Manage sessions | ✅ | ❌ | ❌ | ❌ |
| Manage classes & rules | ✅ | ❌ | ❌ | ❌ |
| Import CSV | ✅ | ❌ | ❌ | ❌ |
| CRUD events | ✅ | ❌ | ❌ | ❌ |
| View published events | ✅ | ✅ (eligible) | ❌ | ✅ (assigned) |
| Book/cancel tickets | ❌ | ✅ | ❌ | ❌ |
| View own tickets | ❌ | ✅ | ❌ | ❌ |
| Scan QR / mark attendance | ✅ | ❌ | ❌ | ✅ (assigned) |
| Override attendance | ✅ | ❌ | ❌ | ❌ |
| Upload dossier files | ✅ | ❌ | ❌ | ❌ |
| View dossier files | ✅ | ❌ | ❌ | ❌ |
| Upload form templates | ✅ | ❌ | ❌ | ❌ |
| Download form templates | ✅ | ✅ (eligible) | ✅ (class) | ❌ |
| Upload form submissions | ❌ | ✅ (own) | ❌ | ❌ |
| View form submissions | ✅ (all) | ✅ (own) | ✅ (class, v1 optional) | ❌ |
| View all reports | ✅ | ❌ | ❌ | ❌ |
| View class report | ✅ | ❌ | ✅ (own class) | ❌ |
| Export CSV reports | ✅ | ❌ | ✅ (own class) | ❌ |
| Manage users / reset passwords | ✅ | ❌ | ❌ | ❌ |

---

## Key Business Rules

### Username Generation
- Format: `first_initial.first_name.last_name` → lowercase, no diacritics, no spaces
- Duplicates get numeric suffix: `c.ion.popescu2`

### Password Handling
- Auto-generated on import/creation (random 8+ char)
- Stored via Supabase Auth (hashed, never stored plain)
- Plain-text shown ONCE in post-import credential export only
- Admin can trigger password reset (generates new password, exportable once)

### Hour Rounding Rule
- Duration from start_time/end_time → round to nearest whole hour
- 30+ minutes rounds UP (e.g., 1h30m → 2h, 1h20m → 1h)
- `counted_duration_hours` stored as integer on event

### Booking Limit Enforcement
- On booking attempt: sum `counted_duration_hours` of all active (non-cancelled) reservations for student in session
- If `current_sum + event_hours > class_rule.required_value` → BLOCK booking
- Enforced via database function + RLS

### Overlap Detection
- On booking: check if student has any active reservation where `date` matches AND time intervals overlap (`start_time < existing_end AND end_time > existing_start`)
- BLOCK if overlap found

### Attendance → Completion
- Only tickets with status `present` or `late` count toward validated hours
- Completion = sum of `counted_duration_hours` for validated tickets ≥ class rule `required_value`
- Dashboard shows: reserved hours / validated hours / remaining hours

### File Security
- Supabase Storage: private bucket `event-files`
- Dossier files: admin-only access via RLS on storage.objects
- Form templates: accessible to eligible students + admins
- Form submissions: student can access own; admin can access all
- No public URLs

---

## Assumptions

1. Single school deployment — no multi-tenant needed
2. Academic year format: "2025-2026" string
3. ~32 classes, ~800-1000 students, ~50 teachers — modest scale
4. QR scanning uses browser camera API (no native app)
5. CSV import handles up to ~1000 rows per batch
6. No real-time collaboration needed — standard request/response
7. Parent forms uploaded by student account (no parent login in v1)
8. Coordinator teachers may also be homeroom teachers (multiple roles supported)
9. 3 initial admin accounts seeded; more can be added
10. File size limit: 10MB per upload
11. No email notifications in v1
12. Time zone: Europe/Bucharest (EET/EEST)

---

## Implementation Milestones

### M1: Foundation
- Database schema + enums + all tables
- RLS policies + security definer functions
- Seed 32 classes for current academic year
- Auth setup (username/password, no public signup)
- Role management, 3 admin seed accounts
- Basic app shell with routing + role-based redirects

### M2: Admin Core
- Program sessions CRUD
- Classes management + participation rules CRUD
- CSV import (preview, validate, create users, export credentials)
- User management (list, reset password, toggle active)

### M3: Events
- Events CRUD with all validations
- Event duplication
- Event detail page with dossier + template file management
- Coordinator assignment

### M4: Student Booking
- Student dashboard (progress display)
- Event browsing with filters
- Booking flow with overlap + hour limit checks
- Ticket generation with QR code
- Cancellation flow
- Form template download + submission upload

### M5: Attendance
- Mobile-first QR scanner for coordinators
- Manual code entry + student search fallback
- Attendance status marking with validation
- Admin attendance override
- Audit logging

### M6: Reports & Polish
- Admin dashboard with metrics + alerts
- Class / student / event reports
- Homeroom teacher class report view
- CSV export + print-friendly layouts
- UI polish, Romanian labels, mobile optimization
- Nice-to-have features (color coding, charts, completion indicators)

