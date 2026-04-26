# Plan curent — Diagnostic notificări push Android

## Status: implementat

### Modificări aplicate
1. **`send-push-to-user`** + **`send-event-reminders`**: payload Android FCM îmbogățit cu `channel_id: "default"`, `sound`, `notification_priority: PRIORITY_HIGH`. Plus logare detaliată în `send-push-to-user` (project_id Firebase folosit, status HTTP per token, prefix token).
2. **`AndroidManifest.xml`**: adăugate meta-data `default_notification_channel_id = "default"` și `default_notification_icon = ic_launcher`.
3. **`useCapacitorPush.ts`**: 
   - Cere și permisiune `LocalNotifications`.
   - Creează canalul „default” pe Android (importance 5, sound, vibration).
   - În foreground (când app e deschis), planifică o notificare locală nativă vizibilă în system tray (push-urile FCM cu payload `notification` NU se afișează singure pe Android când app e foreground).
   - Listener pentru tap-ul pe notificarea locală navighează la URL-ul din extras.
4. **AdminDashboard**: card „Test notificări push” cu buton care invocă `send-push-to-user` pe contul curent și afișează în toast `fcmProjectId` + statusurile per token (200 OK / 403 SENDER_ID_MISMATCH / 404 / etc.).

### Următorii pași pentru utilizator
- **Web**: nimic; testează din `/admin` → buton „Trimite test”.
- **Android (APK)**: git pull → `npm install` → `npx cap sync android` → rebuild APK → reinstalează pe device. Apoi loghează-te ca admin și apasă „Trimite test”.

### Diagnostic așteptat
Toast-ul de răspuns indică:
- `Project=pyro-89b9f`: secretul Firebase e corect; dacă tot nu apare push, e probabil canal/permisiune device.
- `Project=` alt nume: secret Firebase greșit → trebuie regenerat din Firebase Console pentru projectul `pyro-89b9f`.
- `status=403`/`SENDER_ID_MISMATCH`: același caz — secret Firebase aparține altui project decât cel din `google-services.json`.
- `status=404` / `invalid`: token expirat (se șterge automat la următoarea sincronizare a app-ului).
