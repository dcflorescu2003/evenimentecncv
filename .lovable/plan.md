## Problema

Notificările push nu apar pe Android, deși:
- Token-urile FCM sunt salvate corect în `fcm_tokens` (ultima actualizare azi)
- `send-event-reminders` rulează și creează notificări in-app
- Edge function `send-push-to-user` și `send-event-reminders` apelează FCM v1 API

Cauze probabile, în ordinea probabilității:

### 1. Mismatch între `FIREBASE_SERVICE_ACCOUNT_KEY` și `google-services.json`
`google-services.json` din Android indică Firebase project **`pyro-89b9f`** (sender ID `621457065479`). Token-urile FCM ale device-urilor sunt emise de acest sender. Dacă secretul `FIREBASE_SERVICE_ACCOUNT_KEY` aparține altui project Firebase, FCM v1 va respinge cererile cu `SENDER_ID_MISMATCH` (HTTP 403) și nu va livra nimic.

### 2. Notificările trimise în foreground nu apar pe device
Plugin-ul `@capacitor/push-notifications` NU afișează automat notificare în system tray când app-ul este deschis (foreground). În prezent afișăm un toast Sonner în `useCapacitorPush.ts`, dar nu o notificare locală. Când user-ul are app-ul închis/în background, FCM ar trebui să afișeze automat notificarea (folosim payload `notification`), dar dacă nu ajunge — vezi punctul 1.

### 3. Lipsa canalului default explicit
Pe Android 8+ canalele sunt obligatorii. Plugin-ul creează unul default, dar nu este declarat în `AndroidManifest.xml`, iar payload-ul FCM nu specifică `android.notification.channel_id`.

## Pași de remediere

### Pas 1 — Verificare diagnostic (executat direct de mine după aprobare)
Voi adăuga logare detaliată temporară în `send-push-to-user` (project_id folosit, status FCM per token, primii 30 caractere din răspunsul FCM) și voi crea un buton de test în pagina admin „Trimite push test către mine” care apelează funcția pe contul curent, ca să vedem imediat răspunsul real al FCM (200 OK / 403 SENDER_ID_MISMATCH / 404 UNREGISTERED etc.).

### Pas 2 — Remediere previzibilă în paralel
- **AndroidManifest.xml**: adaug meta-data pentru default notification channel + default icon + culoare:
  ```xml
  <meta-data android:name="com.google.firebase.messaging.default_notification_channel_id" android:value="default" />
  <meta-data android:name="com.google.firebase.messaging.default_notification_icon" android:resource="@mipmap/ic_launcher" />
  ```
- **Edge functions** (`send-push-to-user` + `send-event-reminders`): adaug în payload FCM:
  ```js
  android: {
    priority: "high",
    notification: {
      channel_id: "default",
      sound: "default",
      click_action: "OPEN_APP"
    }
  }
  ```
- **`useCapacitorPush.ts`**: când vine push în foreground, în loc de toast Sonner (care poate nu fi vizibil), afișez și o notificare locală nativă folosind plugin-ul `@capacitor/local-notifications` (sau triggher manual `LocalNotifications.schedule`). Alternativ doar îmbunătățesc toast-ul cu vibrate.

### Pas 3 — După diagnostic
Dacă log-urile arată **`SENDER_ID_MISMATCH`** sau `403`, cauza e secretul Firebase. Voi cere user-ului să încarce noul `FIREBASE_SERVICE_ACCOUNT_KEY` care aparține project-ului `pyro-89b9f` (din Firebase Console → Project settings → Service accounts → Generate new private key).

## Fișiere modificate

- `supabase/functions/send-push-to-user/index.ts` — logare detaliată + payload Android cu channel_id
- `supabase/functions/send-event-reminders/index.ts` — payload Android cu channel_id
- `android/app/src/main/AndroidManifest.xml` — meta-data canal default
- `src/hooks/useCapacitorPush.ts` — fallback local notification în foreground
- `src/pages/admin/AdminDashboard.tsx` (sau pagină dedicată debug) — buton test push

## Notă pentru user

După modificări la Android (manifest), trebuie să faci git pull, `npm install`, `npx cap sync android`, apoi rebuild APK-ul. Modificările la edge functions se aplică instant, fără rebuild.
