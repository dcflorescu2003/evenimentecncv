

## Analysis

The push notification system is already fully implemented:
- **Service Worker** (`public/sw.js`) handles push events
- **`usePushNotifications` hook** manages subscribe/unsubscribe
- **`PushNotificationToggle`** button in `StudentLayout` header
- **`send-event-reminders` edge function** runs daily at 18:00, sends push + in-app notifications
- **`push_subscriptions` table** stores browser subscription data

**The problem**: Students must manually find and click the small bell icon to opt in. On mobile, this is easy to miss.

## Plan

### 1. Auto-prompt push notification permission on student login (mobile)

Add a **prompt dialog/banner** that appears automatically when a student logs in on mobile (or any device) and hasn't subscribed to push notifications yet. This will:

- Detect if push is supported and permission is `"default"` (not yet asked)
- Show a friendly modal/banner explaining the benefit: "Primește notificări pe telefon cu o zi înainte de evenimente"
- Include "Activează" and "Nu acum" buttons
- Store dismissal in `localStorage` so it doesn't re-appear every session (show again after 7 days if still not subscribed)
- Trigger automatically in the `StudentLayout` or `StudentDashboard` after login

### 2. Implementation details

**New component: `PushNotificationPrompt.tsx`**
- Uses `usePushNotifications` hook
- Checks `localStorage` for `push_prompt_dismissed_at`
- If push is supported, not subscribed, permission is `"default"`, and not recently dismissed → show a bottom sheet or card prompt
- On "Activează" → calls `subscribe()` which triggers the browser permission dialog
- On "Nu acum" → stores timestamp in localStorage, hides for 7 days

**Integrate into `StudentLayout.tsx`**
- Render `<PushNotificationPrompt />` inside the layout so it appears on any student page after login

### 3. No backend changes needed
The existing edge function, cron job, VAPID keys, and tables all work correctly. This is purely a UX improvement to increase push subscription adoption on mobile.

