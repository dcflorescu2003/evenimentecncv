## Obiectiv

Adaugă în `/admin/classes` un buton **„Promovează clasele”** care, după confirmare, avansează toate clasele cu un an, păstrând dirigintele și elevii. Cazul special: clasele a XII-a devin clase a IX-a goale (elevii absolvenți sunt șterși complet din sistem).

## Comportament funcțional

La click pe „Promovează clasele”, se deschide un dialog de confirmare care:

1. Rezumă ce se va întâmpla (nr. clase de promovat, nr. elevi a XII-a care vor fi șterși, nr. clase a XII-a care devin a IX-a).
2. Cere admin-ului să **selecteze noul an școlar** (ex. „2026-2027”), cu valoare implicită = anul școlar curent +1.
3. Cere o confirmare suplimentară prin tastarea cuvântului `PROMOVEAZĂ` (acțiune ireversibilă).

La confirmare, se execută într-un edge function nou (`admin-promote-classes`) cu service role:

**Pas 1 — Absolvenți (clasele a XII-a curente):**

- Se identifică toți elevii din `student_class_assignments` cu `class_id` în clasele a XII-a.
- Pentru fiecare elev se șterge complet contul (profile, user_roles, reservations, tickets, form_submissions, push_subscriptions, fcm_tokens, notifications, event_student_assistants, attendance_log via cascadă) + `auth.admin.deleteUser()` — refolosind logica din `delete-own-account`.
- Toate `student_class_assignments` pentru clasele a XII-a sunt șterse.

**Pas 2 — Conversie XII → IX:**

- Pentru fiecare clasă a XII-a: `grade_number = 9`, `display_name = "IX " + section`, `academic_year = <noul an>`. Dirigintele rămâne neschimbat. Nu mai are elevi.

**Pas 3 — Promovare clase V–XI:**

- `grade_number += 1` și `display_name` se recalculează cu cifra romană corespunzătoare (V→VI, …, XI→XII).
- `academic_year` se setează la noul an.
- Elevii (`student_class_assignments`) și dirigintele rămân atașați aceleiași clase (doar coloanele clasei se schimbă).
- `student_class_assignments.academic_year` se actualizează la noul an pentru toate înregistrările păstrate.

**Pas 4:** Audit log în `audit_logs` cu sumar (clase promovate, elevi absolvenți șterși).

## Ordine sigură de execuție în edge function

```text
1. Validează rol admin (JWT)
2. Citește toate clasele grupate pe grade_number
3. Pentru fiecare elev XII: șterge cont complet (cascade pe rezervări/bilete + auth user)
4. UPDATE classes SET grade_number=9, display_name='IX '||section, academic_year=$1 WHERE grade_number=12
5. UPDATE classes SET grade_number=grade_number+1, display_name=<roman>, academic_year=$1 WHERE grade_number BETWEEN 5 AND 11 (de la 11 la 5, descendent, ca să evităm conflicte de unicitate dacă există)
6. UPDATE student_class_assignments SET academic_year=$1
7. INSERT audit_logs
```

Cifre romane folosite: V, VI, VII, VIII, IX, X, XI, XII.

&nbsp;

Acelasi lucru ca la clasa 12 trebuie sa il favem si la clasa 8. Ei se sterg din baza de date, sunt alt ciclu. Deci 5 devine 6, 6 devine 7, 7 devine 8 si 8 devine 5 fara elevi doar cu diriginte

## Modificări tehnice

**Edge function nouă: `supabase/functions/admin-promote-classes/index.ts**`

- Validează JWT + rol `admin` (folosește pattern din `admin-manage-users`).
- Acceptă body `{ new_academic_year: string }` cu validare Zod (format `^\d{4}-\d{4}$`).
- Folosește `SUPABASE_SERVICE_ROLE_KEY` pentru ștergere `auth.admin.deleteUser()`.
- Refolosește logica de cleanup din `delete-own-account` (extras într-un helper local în fișier).
- Returnează `{ promoted_classes: number, deleted_students: number, converted_classes: number }`.

**Pagina `src/pages/admin/ClassesPage.tsx`:**

- Buton nou `Promovează clasele` (variant `outline`, icon `GraduationCap` sau `ArrowUp`) lângă butonul existent „Adaugă clasă”.
- AlertDialog de confirmare cu:
  - Sumar pre-calculat din datele deja în cache (clase pe grad, contoare elevi a XII-a).
  - Input `Select` / `Input` pentru noul an școlar (default = an curent +1).
  - Input text pentru tastarea `PROMOVEAZĂ`.
- Mutație care apelează `supabase.functions.invoke('admin-promote-classes', { body: { new_academic_year } })`.
- La succes: toast cu sumar + invalidate `["classes"]`, `["student_class_assignments"]`, `["all_students"]`.

## Riscuri & mitigare

- **Ireversibil:** confirmare dublă (text `PROMOVEAZĂ` + dialog).
- **Conflict de unicitate la display_name:** display_name nu are constraint unique → ok. Dacă apare în viitor, edge function poate face update-urile într-o tranzacție prin RPC.
- **Reguli participare (`class_participation_rules`):** rămân legate de același `class_id` (corect, deoarece clasa „rămâne aceeași entitate, doar promovată”). Nu se modifică, dar admin poate vrea să le revizuiască — vom menționa în toast-ul de succes.
- **Elevi a XII-a cu rezervări active:** ștergerea cascadează automat (RLS-ul existent permite admin să șteargă orice).