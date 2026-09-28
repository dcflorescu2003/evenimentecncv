# Locație: „În liceu" (sală) sau „În afara liceului"

## Ce se schimbă

În formularul de eveniment, câmpul „Locație" devine o alegere între două variante:

1. **În liceu**: apare o listă cu sălile școlii (aceeași listă folosită la Smart Lab: Sala 1, Sala 2 …).
  - Lista arată **doar sălile libere** în ziua și intervalul orar completate mai sus. Dacă data sau orele nu sunt completate, lista rămâne blocată cu mesajul „Alege întâi data și orele".
  - Dacă schimbi data sau ora după ce ai ales o sală care între timp e ocupată, sala se golește și primești un mesaj.
  - Două evenimente nu pot fi programate în aceeași sală la ore care se suprapun. Regula e verificată și în baza de date, deci nu poate fi ocolită (de exemplu, doi profesori care salvează simultan). Evenimentele anulate nu ocupă sala.
2. **În afara liceului**: câmpul text liber, exact ca acum.

Evenimentele existente rămân „În afara liceului", cu textul lor actual, până când cineva le editează.
Listele și detaliile evenimentelor afișează numele sălii, la fel ca locația de acum.

## Detalii tehnice

- Coloană nouă `events.room_id uuid null` (referință la `vr_rooms`). La salvarea unei săli, `location` se completează automat cu numele sălii, ca afișările, PDF-urile și notificările existente să funcționeze fără schimbări.
- Trigger `BEFORE INSERT/UPDATE` pe `events`: dacă `room_id` e setat și există alt eveniment cu status ≠ cancelled, aceeași sală, aceeași dată și ore care se intersectează, operația e respinsă cu mesajul „Sala … este ocupată între … și … de evenimentul „…"". Un lock pe sală + dată previne cursele între salvări simultane.
- Funcție `get_available_rooms(_date, _start, _end, _exclude_event_id)` (security definer, doar pentru utilizatori autentificați). Returnează sălile active libere, inclusiv față de evenimentele pe care profesorul nu le vede.
- Componentă comună `LocationField` (comutator „În liceu / În afara liceului" + listă de săli sau câmp text), folosită în formularele din `ProfEventsPage`, `ProfEventDetailPage` și `EventsPage` (admin). Validarea la salvare cere o sală dacă e bifat „În liceu".
- Rezervările VR din Smart Lab nu blochează sălile pentru evenimente (sunt un sistem separat).  
  
Sa ai grije si ciornele sa nu ocupe sala, sau evenimentele sterse sau modificate sa elibereze sala respectiva