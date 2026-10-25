# Îmbunătățiri pentru sesiunile următoare

## 1. Perioada de înscriere stabilită la sesiune
- În formularul sesiunii (admin) apar două câmpuri opționale: „Înscrieri de la” și „Înscrieri până la” (dată + oră, 24h).
- Dacă sunt completate, la crearea/editarea unui eveniment din acea sesiune câmpurile de înscriere sunt blocate și afișează perioada sesiunii, cu mesajul „Perioada de înscriere este stabilită de sesiune”.
- Serverul aplică automat perioada sesiunii pe toate evenimentele ei (inclusiv cele existente, când adminul o modifică), deci nu poate fi ocolită.
- Dacă nu sunt completate, totul rămâne ca acum.

## 2. Scanare mai ușoară: lista de bilete descărcată pe telefon
Propunere: la deschiderea ecranului de scanare, aplicația descarcă o singură dată lista biletelor evenimentului (cod, nume, clasă, status) — de obicei câteva zeci de rânduri.
- Scanarea verifică instant codul în lista locală: „Bilet negăsit” / „Alt eveniment” / „Deja prezent” apar imediat, fără așteptare.
- Marcarea prezenței se trimite pe server în fundal; dacă nu e internet, se pune într-o coadă și se trimite automat la revenirea conexiunii (indicator „X marcări în așteptare”).
- Lista se reîmprospătează automat la câteva minute și la buton „Actualizează” (pentru înscrierile de ultim moment).
- Căutarea după nume devine și ea locală, instantă.
- Funcționează la fel pentru profesori, coordonatori, admin și elevi asistenți; serverul verifică în continuare drepturile la fiecare marcare.

## 3. Clase la care predă profesorul
- Admin: în pagina de utilizatori/profesori, o secțiune „Clase la care predă” (selecție multiplă). Se folosește aceeași asociere pe care o au deja profesorii în Portofoliu, deci datele existente se păstrează.
- Promovarea claselor actualizează clasa existentă (ex. IX A devine X A), deci asocierile o urmează automat; clasele absolvente dispar din listă.
- Sesiune: bifă „Evenimentele profesorilor se afișează obligatoriu claselor la care predau”.
- Când bifa e activă, la crearea evenimentului clasele profesorului sunt preselectate și blocate (nu pot fi scoase); profesorul poate adăuga alte clase. Serverul le adaugă și el automat la salvare.
- Dacă profesorul nu are clase asociate, apare un avertisment și poate alege liber.

## 4. Module noi: Catalog și Classroom
- În pagina Module apar „Catalog” (scoalanoua.ro) și „Classroom” (classroom.google.com), pentru toate rolurile, deschise în browser / filă nouă.

## 5. Link de distribuire pentru eveniment
- Buton „Copiază link” pe pagina evenimentului (organizator, coordonatori, admin), cu confirmarea „Link copiat”.
- Linkul duce la o adresă scurtă a evenimentului; dacă persoana nu e logată, după autentificare (inclusiv după schimbarea parolei la prima conectare) ajunge direct la eveniment, în varianta potrivită rolului (elev: pagina de înscriere; profesor: detaliile).
- Dacă elevul nu este eligibil, vede mesajul obișnuit „Evenimentul nu este disponibil pentru tine”.

## Detalii tehnice
- `program_sessions`: coloane noi `booking_open_at`, `booking_close_at` (timestamptz, nullable), `force_teacher_classes` (bool default false). Trigger pe `events` (BEFORE INSERT/UPDATE) care suprascrie perioada de înscriere din sesiune și adaugă clasele din `portfolio_teacher_classes` ale creatorului când bifa e activă; trigger pe `program_sessions` care propagă perioada la evenimente.
- Scanare: RPC nou `get_event_scan_roster(_event_id)` (SECURITY DEFINER, aceleași verificări de drept ca `scan_event_ticket`) care întoarce biletele elev + vizitator. `EventScanScreen` păstrează roster-ul în memorie + `localStorage`, validează local, trimite prin `set_ticket_attendance` / `set_public_ticket_attendance` (status calculat local cu `determineAutoStatus`), coadă offline cu retry. `scan_event_ticket` rămâne ca rezervă când codul nu e în listă (înscriere recentă). Se actualizează regula din AGENTS.md.
- Registry module: suport pentru `externalUrl` (pe mobil `window.open` / Capacitor Browser).
- Link: ruta `/e/:id` care redirecționează după rol; `ProtectedRoute`/Login salvează `redirectTo` și navighează după sesiune hidratată.
- Admin: editor de clase predate în UsersPage scriind în `portfolio_teacher_classes` (politică RLS pentru admin dacă lipsește).
