

# Plan: Scanare QR pentru Elevii Asistenți

## Rezumat
Elevii asignați ca asistenți la un eveniment vor putea scana biletele participanților, similar cu profesorii și coordonatorii. Se va crea o pagină de scanare dedicată accesibilă din dashboard-ul/biletele elevului, vizibilă doar pentru evenimentele unde este asistent.

## Modificări necesare

### 1. Pagină nouă: `src/pages/student/StudentScanPage.tsx`
- Copiază logica din `ProfScanPage.tsx` (scanare QR, cod manual, căutare participanți)
- Navigarea înapoi duce la `/student` sau `/student/tickets`
- Restricție: pagina verifică că elevul curent este asistent la evenimentul respectiv (`event_student_assistants`)

### 2. Rută nouă în `App.tsx`
- Adaugă `/student/scan/:eventId` în rutele student (sub `ProtectedRoute` cu rol `student`)

### 3. Buton de scanare în interfața elevului
- În `StudentDashboard.tsx` sau `StudentTicketsPage.tsx`: pentru biletele de tip asistent, afișează un buton „Scanează bilete" care navighează la `/student/scan/:eventId`

### 4. Politici RLS (migrare SQL)
- Elevii asistenți trebuie să poată **citi** rezervările și biletele evenimentului unde sunt asistenți (pentru căutare participanți)
- Elevii asistenți trebuie să poată **actualiza** biletele (status, checkin_timestamp) pentru evenimentul lor
- Elevii asistenți trebuie să poată **insera** în `attendance_log`
- Elevii asistenți trebuie să poată citi `public_reservations` și actualiza `public_tickets` pentru evenimentul lor
- Trebuie să poată citi `student_class_assignments` pentru participanții la eveniment (pentru afișarea clasei)
- Se va folosi o funcție `SECURITY DEFINER` (`is_assistant_for_event`) pentru a evita recursivitatea RLS

### 5. Funcție SQL nouă
```sql
CREATE FUNCTION is_assistant_for_event(_student_id uuid, _event_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER AS $$
  SELECT EXISTS (
    SELECT 1 FROM event_student_assistants
    WHERE student_id = _student_id AND event_id = _event_id
  )
$$;
```

### Tabele afectate de noi politici RLS
- `reservations` — SELECT pentru asistenți
- `tickets` — SELECT + UPDATE pentru asistenți  
- `public_reservations` — SELECT pentru asistenți
- `public_tickets` — SELECT + UPDATE pentru asistenți
- `attendance_log` — INSERT pentru asistenți
- `student_class_assignments` — SELECT pentru asistenți (prin funcție security definer)
- `profiles` — SELECT pentru asistenți (participanții la eveniment)

