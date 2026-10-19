# Architecture rules

- Event visibility is enforced by database access rules; student-facing filters are presentation-only and must never be the security boundary.
- Manual event enrollment must use `manually_enroll_event_student`; direct reservation/ticket writes cannot enforce organizer/coordinator permissions atomically.- Coordinators leave events only via `leave_event_coordination`; it removes the assignment and notifies the organizer atomically.
- Ticket attendance and staff cancellations go through `set_ticket_attendance` / `cancel_event_reservation` RPCs; direct ticket updates hit slow RLS and time out.
