
## Plan: Trimitere manuală notificări de test pentru evenimentul de mâine

### Context
Funcția `send-event-reminders` rulează automat (cron) și trimite notificări către elevii înscriși la evenimentele de mâine (mode `evening`) sau de azi (mode `morning`). Se trimit prin trei canale: in-app (`notifications`), Web Push, FCM (Android/iOS).

### Soluție
Invoc manual edge function-ul `send-event-reminders` cu `mode: "evening"` (default → evenimente de mâine) folosind `supabase--curl_edge_functions`. Fără modificări de cod.

### Pași
1. Verific cu `supabase--read_query` câte evenimente sunt programate mâine și câți elevi au rezervări (sanity check înainte de trimitere).
2. Apelez `supabase--curl_edge_functions` POST `/send-event-reminders` cu body `{"mode":"evening"}`.
3. Citesc răspunsul: număr de notificări in-app create, FCM trimise, Web Push trimise, tokenuri invalide curățate.
4. Verific log-urile cu `supabase--edge_function_logs` dacă e nevoie de debug.

### Notă deduplicare
Funcția evită dublurile: dacă există deja un rând `notifications` cu același `user_id`, `related_event_id` și `type='event_reminder'`, sare peste in-app, **dar trimite mereu push-uri** (FCM + Web Push) către dispozitivele cu token salvat. Deci pot rerula liniștit pentru test fără spam in-app, însă pe telefon vei primi push de fiecare dată — bun pentru test.

### Acțiune necesară de la tine după test
- Confirmă că ai instalat APK-ul cu pluginul FCM activ și ai acordat permisiunea de notificări.
- Verifică în log dacă există un `fcm_tokens` salvat pentru contul tău de elev.

### Ce NU se schimbă
- Cod, schemă DB, cron job, RLS.
