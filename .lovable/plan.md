

## Plan: Add Maximum Hours Cap to Participation Rules

### Current State
The `class_participation_rules` table has `required_value` which serves as both the target (goal) and the booking cap. When 0, it means unlimited. The student dashboard shows progress against this single value.

### What Changes

**1. Database Migration**
- Add `max_hours` column (integer, nullable, default null) to `class_participation_rules`
- Null or 0 means unlimited
- Update `check_booking_eligibility` function to use `max_hours` as the booking cap (instead of `required_value`)
- Update `get_student_progress` function to return both `required_hours` (target) and `max_hours` (cap)

**2. Admin UI - ClassesPage.tsx**
- Add a "Nr. maxim de ore" input field in the rule dialog (alongside existing "Ore necesare")
- Add a "Fără limită" checkbox for max hours (when checked, max_hours = null)
- Update badge display to show both values: e.g. "Sesiune: 18h necesar / max 24h" or "18h necesar / ∞ max"
- Update save/edit mutations to include `max_hours`

**3. Student Dashboard - StudentDashboard.tsx**
- Update progress display to show max_hours when set (or "Nelimitat" when not)
- When max_hours is set and > 0: show "Ore rămase" based on max_hours, show progress bars against max_hours
- When max_hours is 0/null (unlimited): show "∞" for remaining hours, hide progress bars (or show only validated vs required)
- Keep showing `required_value` as the target goal separately

**4. Booking Logic**
- `check_booking_eligibility`: if `max_hours` is set and > 0, enforce it as the cap; otherwise allow unlimited booking
- `required_value` remains as the target/goal display only (no booking enforcement from it)

### Files Modified
- `supabase/migrations/` - new migration for `max_hours` column + updated functions
- `src/pages/admin/ClassesPage.tsx` - rule form and display
- `src/pages/student/StudentDashboard.tsx` - progress display
- `src/pages/student/StudentEventDetailPage.tsx` - if it shows booking eligibility info

