# Raport diriginte: ore vs. minim + înscriere elevi de către diriginte

## 1. Sumar: ore rezervate / minim și ore validate / minim
În fila „Sumar" a raportului diriginților, coloanele „Ore rezervate" și „Ore validate" vor afișa mereu formatul **ore / minim obligatoriu** (ex. `6 / 17`).
- Dacă pentru clasă nu e setat un minim în sesiune, apare `6 / —`.
- Elevii sub minim sunt evidențiați (text roșu la orele rezervate), ca dirigintele să-i vadă imediat.
- Același format și în exportul PDF.
- Corectez și citirea biletelor, care acum se oprește la primele 1000 (poate da ore validate greșite la volume mari).

## 2. Click pe elev -> înscriere la eveniment
Numele elevului din tabel devine clicabil și deschide o fereastră:
- sus: orele rezervate / minim și orele validate / minim ale elevului;
- lista evenimentelor viitoare din sesiunea selectată la care elevul se poate înscrie: publicate, cu locuri libere, deschise clasei/anului elevului, fără suprapuneri cu alte rezervări și la care nu e deja înscris;
- buton „Înscrie" la fiecare eveniment; elevul primește notificare și bilet, ca la înscrierea manuală existentă.

Dirigintele poate înscrie doar elevii din clasele lui, și doar la evenimente pentru care clasa respectivă este eligibilă.

## Detalii tehnice
- `formatHoursVsRequired` primește variantă care afișează `—` când nu există minim; folosită în `SumarTab` din `TeacherReportsPage.tsx`.
- Tickets: filtrare pe `reservation_id` din rezervările elevilor, cu chunking (`supabase-chunk`).
- Migrare: extind `manually_enroll_event_student` — permisiune suplimentară: `is_teacher_for_student(actor, student)` (diriginte) **și** evenimentul e intern, publicat, neanulat, viitor, iar clasa/anul elevului e în lista de eligibilitate a evenimentului. Restul verificărilor (capacitate, suprapuneri, duplicate, audit, notificare) rămân neschimbate.
- RPC nou `list_enrollable_events_for_student(_student_id, _session_id)` (security definer, doar diriginte/admin) care returnează evenimentele eligibile cu locuri libere și fără suprapuneri.
- Componentă nouă `HomeroomEnrollDialog` care folosește RPC-ul de listare și `enrollStudent` din `manual-enrollment.ts`; după înscriere se reîmprospătează raportul.
