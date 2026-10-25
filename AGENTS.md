# Architecture rules

- Shared feedback links open the respondent form under authentication and existing feedback RLS, never the results report; unreadable forms must not trigger question fetches or expose cached data from another user.

- Event visibility is enforced by database access rules; student-facing filters are presentation-only and must never be the security boundary.
- Manual event enrollment must use `manually_enroll_event_student`; direct reservation/ticket writes cannot enforce organizer/coordinator permissions atomically.- Coordinators leave events only via `leave_event_coordination`; it removes the assignment and notifies the organizer atomically.
- Ticket attendance and staff cancellations go through `set_ticket_attendance` / `cancel_event_reservation` RPCs; direct ticket updates hit slow RLS and time out.
- Event ticket scanning: `EventScanScreen` downloads the event roster via `get_event_scan_roster` for instant local validation and queues offline marks; every mark still goes through `scan_event_ticket` (manual via `set_ticket_attendance` / `set_public_ticket_attendance`), since direct ticket reads under RLS time out.
- Session-level booking window and forced teacher classes are applied by the `apply_session_event_rules` trigger on events; UI locks are presentation-only.
- Teacher↔class links live in `portfolio_teacher_classes` (by class id), so class promotion carries them automatically.
- Event scan screens (prof + student assistant) share `EventScanScreen`; participant search goes through `search_event_participants` RPC.
- Student event list, booking and cancellation go only through `list_student_events`, `student_book_event`, `student_cancel_reservation`; direct reads/writes under RLS were slow and left half-made bookings.
