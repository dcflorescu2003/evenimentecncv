# Architecture rules

- Shared feedback links open the respondent form under authentication and existing feedback RLS, never the results report; unreadable forms must not trigger question fetches or expose cached data from another user.
- Feedback management queries are scoped to the creator outside admin pages; report queries are user-scoped and load details only after form access succeeds, with database restrictive policies as the security boundary.

- Event visibility is enforced by database access rules; student-facing filters are presentation-only and must never be the security boundary.
- Manual event enrollment must use `manually_enroll_event_student`; direct reservation/ticket writes cannot enforce organizer/coordinator permissions atomically.- Coordinators leave events only via `leave_event_coordination`; it removes the assignment and notifies the organizer atomically.
- Ticket attendance and staff cancellations go through `set_ticket_attendance` / `cancel_event_reservation` RPCs; direct ticket updates hit slow RLS and time out.
- Event ticket scanning: `EventScanScreen` downloads the event roster via `get_event_scan_roster` for instant local validation and queues offline marks; every mark still goes through `scan_event_ticket` (manual via `set_ticket_attendance` / `set_public_ticket_attendance`), since direct ticket reads under RLS time out.
- Session-level booking window and forced teacher classes are applied by the `apply_session_event_rules` trigger on events; UI locks are presentation-only.
- Teacher↔class links live in `portfolio_teacher_classes` (by class id), so class promotion carries them automatically.
- Event scan screens (prof + student assistant) share `EventScanScreen`; participant search goes through `search_event_participants` RPC.
- Student event list, booking and cancellation go only through `list_student_events`, `student_book_event`, `student_cancel_reservation`; direct reads/writes under RLS were slow and left half-made bookings.
- Dialogs ignore outside clicks by default (close via X/Cancel) to avoid losing form input; React Query defaults: staleTime 60s, no refetch on focus — pages needing fresh data set their own options.
- Competition awards store one row per student with `teacher_id` as the coordinating teacher; competitions list is admin-managed, and only teachers and homeroom teachers may insert awards; RLS limits edits to their teacher (reads also for admin/manager/CSE).
