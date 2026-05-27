## Diagnostic

Contul **CSE** folosește `ProfEventDetailPage`. Permisiunile sunt setate parțial:

| Funcționalitate | Stare actuală |
|---|---|
| 1. Upload fișiere dosar / cerere (`event_files` + bucket `event-files`) | ✅ funcționează — există politică `CSE manage event files` + `Event creators manage event files storage` |
| 1. Upload șablon formular | ✅ funcționează (aceeași politică) |
| 1. Elevi descarcă șablonul (`Students read form templates` pe tabel + storage) | ✅ funcționează |
| 1. Elevi încarcă formular completat (`form-submissions/<student_id>/...`) | ✅ funcționează |
| 2. Lista de participanți: numele elevilor și clasa lor | ❌ **nu se afișează** — nu există politică CSE pe `profiles` și `student_class_assignments` |
| 2. Tickets (status prezență) la participanți | ✅ există `CSE read event tickets` |
| 3. Dialog „Adaugă elev asistent" — căutare elevi | ❌ **listă goală** — nu există politică CSE pe `user_roles` și pe `profiles` |
| 3. Insert în `event_student_assistants` | ✅ există `CSE manage assistants for own events` |

**Cauza** problemelor 2 și 3: politicile RLS pentru `profiles`, `student_class_assignments` și `user_roles` au cazuri pentru `teacher`, `homeroom_teacher`, `coordinator_teacher`, `manager`, `admin`, dar **lipsește `cse`**.

## Soluție — o singură migrare

Adaug 3 politici noi, simetrice cu cele existente pentru profesori, scopate la evenimentele al căror creator este utilizatorul CSE (funcția existentă `is_event_creator`).

### 1) `public.profiles` — CSE citește profilurile participanților la propriile evenimente
```sql
CREATE POLICY "CSE read event participant profiles"
ON public.profiles FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'cse'::app_role)
  AND id IN (
    SELECT r.student_id FROM reservations r
    WHERE is_event_creator(r.event_id, auth.uid())
  )
);
```

### 2) `public.profiles` — CSE citește profilurile elevilor pentru căutarea de asistenți
```sql
CREATE POLICY "CSE read student profiles for assistant assignment"
ON public.profiles FOR SELECT TO authenticated
USING (
  has_role(auth.uid(),'cse'::app_role)
  AND id IN (SELECT user_id FROM user_roles WHERE role = 'student'::app_role)
);
```

### 3) `public.user_roles` — CSE citește rolurile (necesar pentru filtrul `role = student` din dialog)
```sql
CREATE POLICY "CSE read roles for assignment"
ON public.user_roles FOR SELECT TO authenticated
USING (has_role(auth.uid(),'cse'::app_role));
```

### 4) `public.student_class_assignments` — CSE citește clasa elevilor (pentru afișarea „Clasa" în lista de participanți și în dialogul de asistenți)
```sql
CREATE POLICY "CSE read student class assignments"
ON public.student_class_assignments FOR SELECT TO authenticated
USING (has_role(auth.uid(),'cse'::app_role));
```

## Cod aplicație
Nu sunt necesare modificări — `ProfEventDetailPage.tsx` deja gestionează rolul `cse` (`isCse = roles.includes("cse")`), butoanele de upload, dialogul de asistenți și fetch-urile sunt deja scrise; pur și simplu RLS le bloca.

## Verificare după aplicare
1. Login cu cont CSE → eveniment propriu → tab **Fișiere** → upload dosar / cerere ✓
2. Tab **Formulare** → upload șablon → login elev cu rezervare → descărcare + upload formular completat ✓
3. Tab **Participanți** → se văd numele și clasa elevilor ✓
4. Buton **Adaugă elev asistent** → căutare returnează elevi cu nume + clasă ✓
