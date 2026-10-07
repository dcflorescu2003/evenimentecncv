# Coordonatori: avertisment la suprapunere + renunțare cu notificare

## Ce se schimbă pentru utilizatori

**1. Avertisment la suprapunere**
- Când organizatorul (profesor, diriginte, CSE, admin) alege un coordonator, aplicația verifică dacă acea persoană mai coordonează sau organizează un alt eveniment în aceeași zi, la ore care se intersectează.
- Dacă da, apare un mesaj: „Atenție: X coordonează deja „Titlu" pe zz.ll.aaaa, HH:MM–HH:MM. Adaugi oricum?" cu butoanele „Adaugă oricum" și „Renunță".
- Este doar un avertisment, nu un blocaj (un profesor poate avea motive să fie în două locuri, ex. eveniment scurt în același interval).
- Funcționează în formularul de creare (profesor) și în pagina evenimentului (profesor și admin).

**2. Coordonatorul poate renunța**
- În „Evenimentele mele", la evenimentele marcate „Coordonator", și în pagina evenimentului, apare butonul „Renunț la coordonare".
- Se cere confirmare, cu un câmp opțional „Motiv".
- După confirmare, persoana nu mai e coordonator, iar evenimentul dispare din lista ei și nu se mai numără la normă.
- Organizatorul nu poate „renunța" la propriul eveniment.

**3. Notificare către organizator**
- Organizatorul primește o notificare în aplicație (clopoțel) și push: „X a renunțat la coordonarea evenimentului „Titlu"" plus motivul, dacă a fost scris. Apăsând pe ea se deschide evenimentul.
- Coordonatorul adăugat primește și el o notificare când e adăugat, ca să afle că poate renunța (nouă — confirmă dacă o vrei).

## Detalii tehnice
- Funcție nouă `get_coordinator_conflicts(_teacher_id, _event_id | date/start/end)` (SECURITY DEFINER): întoarce evenimentele din aceeași zi cu ore intersectate unde persoana e creator sau în `coordinator_assignments`, excluzând ciornele, anulatele și evenimentul curent. Apelată înainte de insert în ProfEventsPage, ProfEventDetailPage, EventDetailPage.
- Funcție nouă `leave_event_coordination(_event_id, _reason text)` (SECURITY DEFINER): șterge rândul propriu din `coordinator_assignments`, inserează notificarea pentru `events.created_by`, scrie în `audit_logs`. Permisă doar pentru `auth.uid()` coordonator la acel eveniment. Push trimis prin funcția existentă send-push-to-user.
- Notificare la adăugare: insert în `notifications` după adăugarea coordonatorului.
- Rutarea notificării (notification-routing.ts) spre pagina evenimentului organizatorului.
- Necesită actualizare mobil (cod nou în aplicație) — bump de versiune doar dacă ceri.
