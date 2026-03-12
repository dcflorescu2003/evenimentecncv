

# Plan: Fixes and Feature Additions

## 1. Fix: Last created user not appearing
**Root cause**: The Supabase query defaults to a max of 1000 rows. If there are many users, the newest won't show. Also, after creating a user via the edge function, there may be a race condition before the profile is visible.

**Fix**: Add explicit `.limit(10000)` or paginate. Also ensure `refetchOnMount` behavior is correct. The query already invalidates on success, so likely this is just the row limit.

## 2. Rename "Coordonator" → "Asistent"
**Scope**: UI-only label change. The database enum `coordinator_teacher` stays the same.

**Files to update** (all `roleLabels` and text references):
- `UsersPage.tsx` — roleLabels
- `ImportPage.tsx` — CSV template text, valid roles description
- `CoordinatorLayout.tsx` — header text "CNCV Coordonator" → "CNCV Asistent"
- `CoordinatorDashboard.tsx` — greeting text
- `EventDetailPage.tsx` — coordinator tab label stays "Coordonatori" (refers to event coordinators, not the role)
- `Login.tsx` — no change needed
- `TeacherDashboard.tsx` — if any reference

## 3. Diriginte + Profesor create events with file management
**Current state**: Only `teacher` role can create events. `homeroom_teacher` only has a class dashboard.

**Database changes**:
- Add RLS policies on `events` for `homeroom_teacher`: INSERT (with `created_by = auth.uid()`), SELECT own, UPDATE own, DELETE own
- Add RLS policies on `coordinator_assignments` for `homeroom_teacher` to manage assignments on own events (using `is_event_creator`)
- Add RLS policies on `event_files` for both `teacher` and `homeroom_teacher` to manage files on own events
- Add RLS on `attendance_log` for `homeroom_teacher`

**Frontend changes**:
- Extend `TeacherLayout.tsx` to add "Evenimente" nav item
- Create routes for diriginte events: `/teacher/events`, `/teacher/events/:id`, `/teacher/scan/:eventId`, `/teacher/event/:eventId`
- Reuse `ProfEventsPage`, `ProfEventDetailPage`, `ProfScanPage`, `ProfEventParticipantsPage` but make them role-aware (accept a base path prop or create thin wrappers)
- OR: Simpler approach — allow `homeroom_teacher` role to access `/prof/*` routes alongside `teacher` role

**Simplest approach**: Update `App.tsx` to allow both `teacher` and `homeroom_teacher` to access `/prof/*` routes. Update `ProfLayout` to show appropriate title. Add event creation links to `TeacherLayout` or merge the two layouts.

## 4. Event coordinators can scan/check attendance
**Already implemented** via `coordinator_assignments` table and existing RLS policies. Teachers assigned as coordinators already have access to scan and participant lists. No changes needed.

## 5. PDF generation after CSV import
**Approach**: Add a "Generează PDF printabil" button on the import results step. Use browser `window.print()` with a print-friendly layout showing name, username, and password in a table format. No server-side PDF generation needed.

**Implementation**: Add a function in `ImportPage.tsx` that opens a new window with a print-ready HTML table of credentials and triggers `window.print()`.

---

## Summary of changes

### Database migration
```sql
-- RLS for homeroom_teacher to create/manage events
CREATE POLICY "Homeroom teachers create events" ON events FOR INSERT TO authenticated
  WITH CHECK (has_role(auth.uid(), 'homeroom_teacher') AND created_by = auth.uid());
-- + SELECT, UPDATE, DELETE own events
-- + coordinator_assignments management for own events  
-- + event_files management for own events
-- + event_files read for teacher role (own events)
```

### Files to modify
1. **`UsersPage.tsx`** — fix limit, rename label
2. **`ImportPage.tsx`** — rename label, add PDF print button, add `teacher` to valid roles
3. **`CoordinatorLayout.tsx`** — rename header
4. **`App.tsx`** — allow `homeroom_teacher` on `/prof/*` routes
5. **`ProfLayout.tsx`** — dynamic title based on role
6. **`ProfEventsPage.tsx`** — no change (uses `created_by = user.id`)
7. **`ProfEventDetailPage.tsx`** — add file upload/management tabs (currently only on admin detail page)
8. **`Login.tsx`** — redirect `homeroom_teacher` to `/prof` instead of `/teacher`
9. **`ProtectedRoute.tsx`** — update redirect logic
10. **`TeacherLayout.tsx`** — keep for class management, or merge into ProfLayout
11. **Database migration** — add ~8 RLS policies

### Architecture decision
Rather than duplicating event pages for diriginte, merge diriginte into the `/prof` routes (since they now share event creation). Keep `/teacher` routes only for class-specific dashboard (student reports). Update the `/prof` layout to also accept `homeroom_teacher` role and show a link to class management (`/teacher`) if the user has that role too.

