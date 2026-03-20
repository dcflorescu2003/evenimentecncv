

## Plan: Improve Push Notification Visibility + Include Assistants in Reminders

The edge function `send-event-reminders` already sends reminders to students with reservations. The issue is that it does NOT also include student assistants. Additionally, the notification prompt needs to be more visible.

### 1. Fix Edge Function to Also Notify Student Assistants

**File:** `supabase/functions/send-event-reminders/index.ts`

- After fetching `reservations`, also query `event_student_assistants` for the same `eventIds`
- Merge assistant student IDs into the `studentEvents` map (same structure)
- Change the early return when `reservations` is empty: instead of returning, continue to check for assistants too
- This ensures both regular ticket holders AND assistants receive in-app + push reminders

### 2. Redesign Push Notification Prompt for Students

**File:** `src/components/PushNotificationPrompt.tsx`

Replace the small floating card with a prominent full-width gradient banner:
- Gradient background with animated bell icon
- Clear benefit text: "Primești remindere cu o zi înainte de evenimentele tale"
- Large "Activează notificările" button + "Nu acum" dismiss
- Same dismiss logic (7 days via localStorage)

**File:** `src/pages/student/StudentDashboard.tsx`

- Import and render the redesigned `PushNotificationPrompt` at the top of the dashboard content (before progress cards)

**File:** `src/components/layouts/StudentLayout.tsx`

- Remove `<PushNotificationPrompt />` from the layout (it moves into the dashboard page instead, no longer floating over bottom nav)

### 3. Post-Booking Notification Prompt

**File:** `src/pages/student/StudentEventsPage.tsx`

- After a successful booking, if push notifications are not enabled, show a toast or inline card encouraging the student to activate notifications

### Summary of changes

| File | Change |
|------|--------|
| `send-event-reminders/index.ts` | Add `event_student_assistants` query, merge into student map |
| `PushNotificationPrompt.tsx` | Redesign as prominent inline gradient banner |
| `StudentDashboard.tsx` | Render prompt at top of page |
| `StudentLayout.tsx` | Remove floating prompt |
| `StudentEventsPage.tsx` | Post-booking notification prompt |

