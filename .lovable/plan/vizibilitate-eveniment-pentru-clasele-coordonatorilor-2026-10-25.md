# Vizibilitate eveniment pentru clasele coordonatorilor

## Ce se schimbă
În sesiunile cu bifa „Pentru clasele la care predă”:
- Când se adaugă un coordonator la un eveniment, clasele la care predă el se adaugă automat la clasele care văd evenimentul.
- Când coordonatorul se retrage (sau e scos), se scot doar clasele adăugate pentru el, dacă nu le mai acoperă organizatorul sau alt coordonator. Clasele alese de mână de organizator rămân.
- Dacă bifa se activează pe o sesiune care are deja evenimente, clasele coordonatorilor existenți se adaugă și la acestea.
- La sesiunile fără bifă nu se schimbă nimic.

Excepții (ca la regula actuală): evenimentele publice, cele CSE și cele create de admin nu sunt modificate. Un eveniment fără clase selectate (vizibil tuturor) rămâne vizibil tuturor.

Elevii deja înscriși dintr-o clasă care e scoasă își păstrează înscrierea și biletul.

## Detalii tehnice
- Coloană nouă `events.coordinator_added_classes uuid[] default '{}'` — reține doar clasele adăugate automat (nu cele deja prezente), ca la retragere să știm ce putem scoate.
- Funcție `sync_event_coordinator_classes(_event_id)`: recalculează setul = clasele (portfolio_teacher_classes) ale coordonatorilor actuali minus clasele organizatorului/alese manual; adaugă ce lipsește în `eligible_classes`, scoate ce nu mai e acoperit din setul automat.
- Triggere AFTER INSERT/DELETE pe `coordinator_assignments` care apelează funcția (acoperă și `leave_event_coordination`).
- Extindere `propagate_session_booking` (la activarea bifei) să ruleze sincronizarea pe evenimentele sesiunii.
- Fără modificări de interfață; lista „Clase eligibile” reflectă automat noul set.
