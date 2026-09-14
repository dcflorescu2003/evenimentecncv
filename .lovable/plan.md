# Legitimația digitală a elevului (QR personal) pentru cluburi și voluntariat

## Ce se schimbă pentru utilizatori

### 1. QR-ul personal al elevului
- Fiecare elev primește un cod QR propriu, permanent, disponibil în aplicație pe o pagină nouă „Legitimația mea”.
- Ecranul afișează numele, clasa și codul QR mare, ușor de scanat, cu opțiune de luminozitate maximă.
- Codul nu expiră și nu trebuie regenerat; se poate folosi la orice activitate care cere prezență.

### 2. Coordonatorul scanează elevii
- La o întâlnire de club sau o zi de voluntariat, coordonatorul (sau elevul asistent) deschide „Scanează prezența”.
- Scanează pe rând legitimațiile elevilor; fiecare scanare marchează instant prezența.
- Regulile de oră rămân aceleași ca la evenimente: în intervalul permis se marchează „Prezent”, în afara lui „Întârziat”.
- Mesaje clare la scanare: elev neînscris la club, deja marcat, sau în afara intervalului.
- Lista manuală de prezență rămâne disponibilă ca alternativă.

### 3. Elevul scanează QR-ul întâlnirii
- Coordonatorul poate afișa pe ecran/proiector codul QR al întâlnirii sau al zilei de voluntariat.
- Elevul îl scanează din aplicație și își marchează singur prezența, dacă este înscris și în intervalul orar.

### 4. Unde se folosește
- Cluburi și voluntariat acum; mecanismul e construit generic, ca să poată fi refolosit de module viitoare.
- Biletele individuale pentru evenimente rămân neschimbate.

## Detalii tehnice

Bază de date:
- Fără tabel nou pentru identitate: QR-ul personal codifică un identificator derivat din `profiles.id`, cu prefix de tip (`CNCV-STU:<uuid>`), validat la scanare.
- Funcții `security definer` noi:
  - `mark_club_attendance_by_qr(_meeting_id uuid, _student_qr text)` — verifică drepturile (coordonator, creator, admin, elev asistent), înscrierea aprobată, fereastra orară; face upsert în `club_attendance` cu `present`/`late` și `checkin_at`.
  - `mark_volunteer_attendance_by_qr(_day_id uuid, _student_qr text)` — echivalent pe `volunteer_attendance`.
  - `self_checkin_club(_qr_code_data text)` și `self_checkin_volunteer(_qr_code_data text)` — elevul trimite codul întâlnirii/zilei; funcția rezolvă întâlnirea, verifică înscrierea și fereastra orară, apoi scrie prezența.
- Fereastra de timp refolosește regula existentă de la evenimente (-30 min → +15 min pentru „Prezent”, ulterior „Întârziat”).
- Fără modificări de RLS pe tabelele de prezență: scrierea se face prin funcțiile de mai sus.

Frontend:
- Pagină nouă `src/pages/student/StudentBadgePage.tsx` (rută `/student/badge`) cu QR generat local (`qrcode.react` sau librăria QR deja folosită), plus intrare în meniul elevului.
- Componentă reutilizabilă `src/components/scan/StudentQrScanner.tsx` peste `html5-qrcode`, extrasă din logica existentă din `StudentScanPage.tsx` / `ScanPage.tsx`, cu feedback sonor și listă de rezultate.
- În `ClubDetailPage.tsx` (tab Întâlniri) și `VolunteerProjectDetailPage.tsx` (tab Zile): buton „Scanează prezența” pentru personal și „Afișează QR întâlnire” pe baza `club_meetings.qr_code_data` / `volunteer_days.qr_code_data`.
- În pagina elevului: buton „Scanează QR-ul întâlnirii” care apelează funcțiile de self check-in.
- Invalidarea query-urilor existente de prezență după fiecare scanare.

## Efort estimat
Moderat: nu necesită schimbări structurale mari, ci patru funcții de bază de date și reutilizarea scannerului existent. Livrabil într-o singură etapă de implementare.
