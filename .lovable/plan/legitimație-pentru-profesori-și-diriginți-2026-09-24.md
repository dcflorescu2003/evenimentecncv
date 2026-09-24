# Legitimație pentru profesori și diriginți

## Ce se schimbă
- Profesorii și diriginții primesc modulul „Legitimație”, identic cu al elevilor: cod QR live (se schimbă la 20 s), cu logo CNCV, nume și mențiunea „Profesor” / „Diriginte” (în loc de clasă). Dirigintele vede și clasa pe care o conduce.
- Fără butonul „Scanează QR-ul întâlnirii” pentru profesori (acela e doar pentru prezența elevilor).
- API-ul cantinei:
  - lista pentru import include și profesorii și diriginții, fiecare marcat cu tipul lui (elev / profesor);
  - la scanarea legitimației unui profesor, cantina primește numele și tipul „profesor”.
- Legitimația unui profesor NU poate marca prezența la cluburi/voluntariat ca elev (este respinsă acolo).
- Documentația pentru elevul cu aplicația cantinei se actualizează și ți-o dau din nou.

## Detalii tehnice
- Baza de date:
  - `issue_student_qr()` se permite pentru roluri elev, teacher, homeroom_teacher (tabelul de tokenuri se refolosește; `student_id` = id-ul utilizatorului).
  - `resolve_student_badge_public` returnează în plus `user_type` (`student` / `teacher`), `roles`, iar pentru profesori `class` = clasa de diriginție (dacă există), altfel null. Câmpurile existente rămân, deci aplicația cantinei nu se strică.
  - `mark_club_attendance_by_qr`, `mark_volunteer_attendance_by_qr`: verificare că titularul codului are rol de elev.
- Edge function `canteen-api`: `/students` primește parametru opțional `type=student|teacher|all` (implicit `all`), adaugă `user_type`; se poate adăuga alias `/users`.
- Frontend:
  - `src/modules/registry.ts`: modulul „badge” disponibil și pentru teacher / homeroom_teacher, cu rută `/badge`.
  - `src/App.tsx`: rută `/badge` accesibilă tuturor rolurilor de mai sus, folosind `StudentBadgePage` generalizată (ascunde scanarea întâlnirii pentru profesori, afișează rolul).
- `docs/canteen-api.md` + documentul din Files actualizate.
- Bump de versiune (1.27) pentru Android/iOS/package.json.
