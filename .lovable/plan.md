## Obiectiv

Click pe o notificare (în clopoțelul aplicației sau pe push-ul de sistem) duce utilizatorul direct la pagina relevantă, în funcție de rolul lui și de tipul notificării.

## Cum se mapează notificările → rute

| Tip notificare | Cine o primește | Rută destinație |
|---|---|---|
| `morning_reminder`, `event_reminder` | Elev | `/student/events/:related_event_id` |
| `homeroom_absence_alert` | Diriginte | `/prof/events/:related_event_id` (detalii eveniment + tab prezență) |
| Orice altă notificare cu `related_event_id` | Admin | `/admin/events/:related_event_id` |
| | Profesor / CSE | `/prof/events/:related_event_id` |
| | Coordonator | `/coordinator/event/:related_event_id` |
| | Manager | `/manager/events` |
| Notificare fără `related_event_id` | toți | rămâne pe pagina curentă, doar marchează citită |

Mapping-ul se face într-un helper `getNotificationUrl(notification, roles)` în `src/lib/notification-routing.ts`, ca să fie reutilizat și pe web, și în payload-ul push.

## Schimbări UI (in-app: clopoțelul)

`src/components/NotificationBell.tsx`:
- Folosește `useAuth()` pentru roluri și `useNavigate()`.
- Fiecare item devine `<button>` clickabil. La click:
  1. Marchează notificarea ca citită (`update notifications set is_read=true where id=…`).
  2. Calculează URL-ul cu `getNotificationUrl()`.
  3. Închide popover-ul și navighează (`navigate(url)`).
- Cursor pointer + hover state pentru feedback vizual.

## Schimbări push (notificări de sistem)

Infrastructura există deja: `public/sw.js` și `useCapacitorPush.ts` deschid `data.url` la click. Trebuie doar să trimitem `url` în payload.

- `supabase/functions/send-event-reminders/index.ts`: la trimiterea Web Push și FCM, adaugă `url: "/student/events/<eventId>"` în `data`.
- `supabase/functions/notify-homeroom-absences/index.ts`: la trimiterea push către diriginți, adaugă `url: "/prof/events/<eventId>"`.
- `supabase/functions/send-push-to-user/index.ts`: deja acceptă `url` în body (verificat în dashboard test) — păstrăm.

## Detalii tehnice

- Helper-ul `getNotificationUrl` primește `{ type, related_event_id }` + array de roluri (în ordinea priorității: admin → manager → coordinator_teacher → teacher/homeroom_teacher/cse → student) și returnează un string sau `null`.
- Pentru diriginți, ruta `/prof/events/:id` afișează deja detalii + listă prezență, deci e suficientă (nu e nevoie de o rută nouă "scan/prezență directă").
- Nu modificăm schema DB — folosim coloanele existente `type` și `related_event_id`.

## Fișiere atinse

- `src/lib/notification-routing.ts` (nou)
- `src/components/NotificationBell.tsx`
- `supabase/functions/send-event-reminders/index.ts`
- `supabase/functions/notify-homeroom-absences/index.ts`