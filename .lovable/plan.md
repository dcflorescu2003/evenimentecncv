## Notificări automate planificate

### 1. Notificare elevi dimineața — la 09:30 (GMT+3)

Funcția `send-event-reminders` cu `mode: "morning"` deja există și funcționează (trimite notificare elevilor cu rezervare în ziua curentă).

**Schimbare:** mutăm cron job-ul `send-morning-reminders` din ora 07:00 UTC (= 10:00 GMT+3) la **06:30 UTC (= 09:30 GMT+3)**.

```text
cron:  30 6 * * *   →  send-event-reminders { mode: "morning" }
```

### 2. Notificare diriginți seara — la 19:00 (GMT+3) după evenimente

Creăm o funcție edge nouă: **`notify-homeroom-absences`**.

**Logica:**
1. Găsește toate evenimentele cu `date = azi` (în Europe/Bucharest).
2. Pentru fiecare eveniment, identifică elevii cu rezervare care au absentat:
   - `tickets.status = 'absent'` (sau `'reserved'` rămas neînregistrat — îl considerăm absent doar dacă ticket-ul e marcat absent; `close-past-events` rulează la 06:00 a doua zi, deci la 19:00 încă nu a marcat automat).
   - **Important:** la 19:00 evenimentul s-a încheiat (verificăm `end_time < now()`), iar elevii încă neprezenți (`status IN ('reserved','absent')`) sunt considerați absenți.
3. Grupează absenții pe diriginte (prin `student_class_assignments` → `classes.homeroom_teacher_id`).
4. Pentru fiecare diriginte cu cel puțin un elev absent la un eveniment azi, creează o notificare:
   - **Titlu:** „Eveniment încheiat — verifică prezența”
   - **Body:** „Evenimentul «X» s-a încheiat. Ai N elev(i) din clasă marcat(i) absent(i). Verifică lista de prezență.”
   - `related_event_id` = id-ul evenimentului
   - `type = 'homeroom_absence_alert'`
5. Trimite și push (Web Push + FCM) folosind aceleași helpere ca în `send-event-reminders`.
6. Deduplicare: nu creează notificare dacă există deja una de același tip pentru același (`user_id`, `related_event_id`).

**Cron nou:** rulează zilnic la **16:00 UTC (= 19:00 GMT+3)**.

```text
cron:  0 16 * * *  →  notify-homeroom-absences
```

### Fișiere

- **Modificat:** `supabase/config.toml` — adaugă bloc `[functions.notify-homeroom-absences]` cu `verify_jwt = false`.
- **Nou:** `supabase/functions/notify-homeroom-absences/index.ts` — logica descrisă mai sus.
- **Migrare SQL:**
  - `cron.unschedule('send-morning-reminders')` și re-schedule la `30 6 * * *`.
  - `cron.schedule('notify-homeroom-absences-daily', '0 16 * * *', ...)`.

### Note tehnice

- Politica RLS pe `notifications` permite INSERT doar pentru admini. Funcția folosește `SUPABASE_SERVICE_ROLE_KEY` care bypass-uiește RLS — OK.
- Detectarea „absent” la 19:00: tickets cu `status IN ('reserved','absent')` pentru rezervări la evenimente cu `date = azi` și `end_time <= now()`. Elevii prezenți (`present`/`late`) sunt excluși.
- Cron-ul rulează în UTC; nu ținem cont de schimbarea oră de vară/iarnă (cum e și acum pentru celelalte joburi). 19:00 GMT+3 = 16:00 UTC vara, iarna devine 18:00 ora locală — acceptăm comportamentul actual al sistemului.
