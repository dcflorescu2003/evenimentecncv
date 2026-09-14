# Legitimație cu cod QR care se schimbă (live)

## Ce se schimbă pentru utilizatori

- Codul QR din „Legitimația mea” nu mai este fix. Se reînnoiește automat la fiecare **20 de secunde**, cu un cerc de numărătoare inversă sub cod.
- Un cod expirat nu mai poate marca prezența. O captură de ecran trimisă unui coleg devine inutilă după câteva secunde.
- Dacă telefonul elevului nu are internet, codul afișat rămâne valabil până la expirare, apoi apare mesajul „Reconectează-te pentru a genera un cod nou”.
- Un cod poate fi folosit o singură dată pentru aceeași întâlnire; scanarea repetată arată „Prezență deja marcată”.
- Vechiul cod permanent nu mai este acceptat la scanare. Marcarea manuală din lista de membri rămâne disponibilă pentru coordonatori, ca alternativă.

## Detalii tehnice

Bază de date (migrare nouă):

- Tabel `student_qr_tokens`: `id`, `student_id` (uuid), `token` (text unique, aleatoriu, ~24 caractere), `expires_at`, `used_at`, `created_at`. RLS: elevul poate citi doar rândurile proprii; scrierea se face exclusiv prin funcții `security definer`. GRANT `SELECT` pentru `authenticated`, `ALL` pentru `service_role`. Index pe `token` și pe `(student_id, expires_at)`.
- `issue_student_qr()` — `security definer`: generează un token pentru `auth.uid()` cu `expires_at = now() + 25s` (20s afișate + 5s toleranță), șterge tokenurile proprii expirate mai vechi de 5 minute și returnează `{ token, expires_at }`.
- `parse_student_qr(_qr text)` se rescrie: acceptă formatul `CNCV-STU2:<token>`, caută tokenul valid (`expires_at > now()`) și returnează `student_id`; formatul vechi `CNCV-STU:<uuid>` este respins.
- `mark_club_attendance_by_qr` / `mark_volunteer_attendance_by_qr` marchează tokenul ca folosit (`used_at`) după o marcare reușită și returnează mesaje distincte pentru „cod expirat” și „cod deja folosit”.
- Curățare: ștergerea tokenurilor expirate se face oportunist la fiecare emitere (fără cron nou).

Frontend:

- `src/pages/student/StudentBadgePage.tsx`: hook nou care apelează `issue_student_qr` la montare și apoi la fiecare 20 de secunde (`setInterval` curățat la unmount, reemitere și la revenirea în prim-plan prin `visibilitychange`). QR-ul afișează `CNCV-STU2:<token>`; sub el, o bară/cerc de progres pentru secundele rămase și starea „offline”.
- `src/components/scan/AttendanceScanDialog.tsx`: mesaje explicite pentru cod expirat/refolosit; restul fluxului rămâne neschimbat.
- Auto-check-in-ul elevului prin scanarea QR-ului întâlnirii (`self_checkin_club` / `self_checkin_volunteer`) rămâne neschimbat.  
  
As vrea ca qr-ul sa fie si animat. Am citit ca se poate sa existe o animatie care ruleaza in timp ce este afisat codul
- &nbsp;