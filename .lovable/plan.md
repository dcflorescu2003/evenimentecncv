

## Plan: Fix past event tickets appearing as "Active" + prevent cancellation of past events

### Problems
1. **Tickets for past events show in "Active" section**: The tickets page splits by `reservation.status === "reserved"` only. A student who was checked in (`present`/`late`) still has reservation status `reserved`, so the ticket appears under "Active" even though the event already happened. Also, events that passed but weren't closed by the cron job remain in "Active".
2. **Students can cancel reservations for past events**: No date check before showing the cancel button.

### Solution

**File: `src/pages/student/StudentTicketsPage.tsx`**

1. Add an `isEventPast` helper (same logic as in `StudentEventsPage.tsx`) that checks if the event date is before today, or if it's today and the `end_time` has passed.

2. Change the active/past split logic:
   - **Active**: `reservation.status === "reserved"` AND event is NOT past AND ticket status is `reserved`
   - **Past/History**: everything else (cancelled, present, late, absent, excused, OR reserved but event already passed)

3. Hide the "Anulează" (cancel) button when the event is past — pass `onCancel` only when event is in the future. This is already partially handled by the `past` prop, but the issue is that past events with `reserved` status don't get the `past` flag.

### Technical Details
- The `isEventPast` function checks: `event.date < today` OR (`event.date === today` AND `now > end_time`)
- The `tickets` relation from Supabase may return an array; handle both array and single object cases for `ticket?.status`
- No database changes needed — this is purely a client-side display/logic fix

