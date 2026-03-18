

## Problem

Currently, when scanning a QR code, the system always shows a dialog asking to manually select the status (present/late/absent/excused). The user wants:

1. **Auto-determine status on scan**: Compare current time vs event `start_time` — if within 30min before to 15min after → "present"; if later than 15min → "late"
2. **Auto-mark absent at event end**: All remaining "reserved" tickets should be marked "absent" after the event ends

## Plan

### 1. Auto-status on scan (both `ScanPage.tsx` and `ProfScanPage.tsx`)

Add a helper function `determineAutoStatus(event)` that:
- Constructs a `DateTime` from `event.date` + `event.start_time`
- Compares with `now()`:
  - If `now <= start_time + 15min` → return `"present"`
  - If `now > start_time + 15min` → return `"late"`
- The 30min-before window is naturally covered (scanning is only possible when the event page is open)

When a valid ticket is scanned in `processTicket()`:
- Instead of showing the dialog and waiting for manual selection, **auto-mark** the ticket with the determined status immediately
- Show a toast with the result (e.g., "✓ Ion Popescu — Prezent") instead of the confirmation dialog
- Keep the dialog only for error cases (already processed, wrong event)

This applies to both QR scan and manual code entry. The search tab keeps manual buttons as-is.

### 2. Auto-mark absent at event end (edge function `close-past-events`)

Extend the existing `close-past-events` edge function to also mark remaining "reserved" tickets as "absent" when closing events:
- After updating event status to "closed", query all `tickets` with status "reserved" for those events and update them to "absent"
- Same for `public_tickets` — update remaining "reserved" to "absent"
- This runs daily at 06:00 via cron, so all events from the previous day get their remaining reserved tickets marked absent

### Files to modify

1. **`src/pages/coordinator/ScanPage.tsx`** — add `determineAutoStatus`, auto-mark on scan, show toast instead of dialog for successful scans
2. **`src/pages/prof/ProfScanPage.tsx`** — same changes
3. **`supabase/functions/close-past-events/index.ts`** — after closing events, bulk-update remaining reserved tickets/public_tickets to "absent"

