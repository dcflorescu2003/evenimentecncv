

## Plan: Afișare evenimente trecute în rapoartele dirigintelui

### Problema
Evenimentele trecute primesc automat statusul `closed` (prin funcția automată de închidere). Politica RLS permite diriginților să vadă doar:
- Evenimentele proprii (create de ei)
- Evenimentele cu `status = 'published'`

Astfel, evenimentele închise create de alți profesori nu apar în niciun tab de raport, chiar dacă elevii dirigintelui au fost înscriși la ele.

### Soluția
Adăugare unei noi politici RLS pe tabela `events` care permite diriginților să citească evenimentele la care elevii lor au rezervări.

### Modificări

**1. Migrare SQL — nouă politică RLS pe `events`**

Se adaugă o politică de tip SELECT care permite homeroom teachers să vadă evenimentele la care elevii din clasele lor au rezervări:

```sql
CREATE POLICY "Homeroom teachers read events with class student reservations"
ON public.events
FOR SELECT TO authenticated
USING (
  has_role(auth.uid(), 'homeroom_teacher'::app_role)
  AND id IN (
    SELECT r.event_id FROM reservations r
    JOIN student_class_assignments sca ON sca.student_id = r.student_id
    JOIN classes c ON c.id = sca.class_id
    WHERE c.homeroom_teacher_id = auth.uid()
  )
);
```

**2. Nicio modificare de cod frontend** — toate cele 3 tab-uri (Situație elevi, Verificare după eveniment, Verificare după dată) folosesc deja query-uri corecte pe `events` filtrate după `session_id`. Odată ce RLS permite accesul la evenimentele închise, datele vor apărea automat.

### Ce se rezolvă
- **Situație elevi**: va afișa toate evenimentele din sesiune unde elevii clasei au fost înscriși (inclusiv cele închise)
- **Verificare după eveniment**: dropdown-ul va include și evenimentele trecute/închise cu participanți
- **Verificare după dată**: datele din calendar vor include și zilele cu evenimente închise

