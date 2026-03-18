

## Problem

In both `EventParticipantsPage.tsx` (coordinator) and `ProfEventParticipantsPage.tsx` (prof), the expanded section with status buttons is guarded by `isExpanded && p.ticketId`. When a reservation exists but its ticket hasn't been created yet, `ticketId` is `undefined`, so the buttons never render for that participant.

This affects any student whose reservation doesn't have a corresponding ticket row -- typically the case when a ticket is only created at booking time and for some reason one wasn't generated.

## Root Cause

`ticketId` comes from `ticket?.id` where `ticket = Array.isArray(p.tickets) ? p.tickets[0] : p.tickets`. If `p.tickets` is an empty array `[]`, then `p.tickets[0]` is `undefined`, so `ticketId` is `undefined`.

## Fix (2 files)

### 1. Auto-create ticket when missing

In both files, modify `updateStatus` (and add a helper) so that when `ticketId` is missing (no ticket exists), a new ticket is created from the reservation before updating status.

### 2. Always show buttons when expanded

Change the condition from `isExpanded && p.ticketId` to just `isExpanded` in both files. When `ticketId` is missing and a status button is clicked, the handler will first create the ticket, then update its status.

### Detailed changes per file:

**`src/pages/coordinator/EventParticipantsPage.tsx`**:
- Add `reservationId` to the `UnifiedParticipant` interface and populate it in the mapping
- Change line 274 from `{isExpanded && p.ticketId && (` to `{isExpanded && (`
- Modify `updateStatus` / add `ensureTicket` helper: if `ticketId` is falsy, insert a new ticket for the reservation, then proceed with the status update
- Pass `reservationId` through `handleStatusClick` and the confirm dialog

**`src/pages/prof/ProfEventParticipantsPage.tsx`**:
- Same changes: line 224 condition, same `ensureTicket` logic
- Already has `reservationId` in the interface

Both files will create the ticket on-demand when a coordinator/teacher clicks a status button, ensuring every participant always shows the action buttons.

