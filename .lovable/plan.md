# Căutare rapidă după nume pentru elevii asistenți

## Ce se schimbă
În fila „Caută” de pe ecranul de scanare al elevilor asistenți, lista de participanți (elevi și vizitatori) se va încărca dintr-un singur pas rapid de pe server, la fel ca scanarea. Nu vor mai exista așteptări lungi sau liste goale la evenimentele mari.

- Se caută după nume, cu sau fără diacritice.
- Pentru fiecare participant se afișează numele, eticheta „Vizitator” dacă e cazul și statusul biletului.
- Butoanele „Prezent” și „Întârziat” rămân la fel.
- Dacă apare o problemă de internet, scrie „Eroare de conexiune, încearcă din nou.”, nu „Niciun participant găsit”.

## Detalii tehnice
- Migrare: o funcție nouă `search_event_participants(_event_id uuid, _q text)`, SECURITY DEFINER, `search_path=public`, grant doar pentru `authenticated`. Verifică dacă utilizatorul e admin, organizator, coordonator sau asistent la eveniment (`is_assistant_for_event`). Întoarce maximum 50 de rânduri: `ticket_id`, `name`, `status`, `is_public`. Caută în rezervările active de elevi (cu `f_unaccent` pe nume) și în biletele vizitatorilor.
- Frontend: `src/lib/ticket-scan.ts` primește `searchEventParticipants()`. `StudentScanPage.tsx` înlocuiește cele două interogări directe cu un singur apel, cu debounce de 300 ms (`useDebouncedValue`).
- `AGENTS.md`: căutarea participanților pe ecranele de scanare trece prin `search_event_participants`.
- Ecranele profesor, coordonator și admin pot folosi ulterior aceeași funcție. În pasul acesta se schimbă doar ecranul asistenților.
