# Evenimente doar în perioada sesiunii + listă filtrată pe sesiune

## Ce se schimbă

1. **Data evenimentului trebuie să fie în intervalul sesiunii**
   - În formularul de eveniment, după ce alegi sesiunea, se afișează intervalul ei (ex. „05.10.2026 – 09.10.2026").
   - Dacă data evenimentului e în afara intervalului, salvarea e blocată cu mesajul „Data trebuie să fie între … și …".
   - Aceeași regulă e verificată și în baza de date, așa că nu poate fi ocolită (se aplică și adminilor și la editare). Evenimentele vechi rămân neatinse, cât timp nu li se modifică data sau sesiunea.
2. **„Evenimentele mele" pe sesiune**
   - Deasupra listei apare o listă de alegere a sesiunii (implicit cea activă), cu opțiunea „Toate sesiunile".
   - Lista de evenimente (create și coordonate) și cartonașul de normă folosesc aceeași sesiune aleasă.

## Detalii tehnice
- Trigger `BEFORE INSERT OR UPDATE OF date, session_id` pe `events`: dacă `date` nu e între `program_sessions.start_date` și `end_date`, se ridică o excepție cu mesaj în română.
- Validare în frontend în formularele din `ProfEventsPage`, `ProfEventDetailPage` și `EventsPage` (admin). Dacă e posibil, și `DateInput` primește min/max.
- `NormProgressCard` primește opțional `sessionId` controlat din exterior. `ProfEventsPage` ține selecția și filtrează `events` după `session_id`.
