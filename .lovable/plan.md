# Reparare eroare la editarea profesorilor + verificare drepturi după restaurare

## Ce am verificat deja

- Funcția `admin-manage-users` returnează non-2xx pentru că verificarea apelantului eșuează: în loguri apare `getUser error: Auth session missing!` la 21:50 și 21:53. Fără apelant valid, `isAdmin` rămâne fals și funcția aruncă „Nu aveți permisiuni de administrator" (răspuns non-2xx, exact toastul din imagine).
- Drepturile pe tabele au fost verificate direct în bază: `authenticated` și `service_role` au din nou acces pe toate cele 60 de tabele publice, iar coloana `email` din profiluri rămâne corect blocată pentru utilizatori.
- **Regresie de securitate găsită**: restaurarea a repus drepturi complete de scriere pentru rolul `anon` (vizitatori nelogați) pe 58 de tabele publice, inclusiv `user_roles`, `module_access`, `audit_logs`, `portfolio_*`. Momentan sunt protejate doar de politicile RLS; întăririle făcute anterior (retragerea accesului `anon`) au fost pierdute la restaurare.
- Sesiunile de autentificare există (816 sesiuni active, ultima autentificare 31.08 21:43), deci baza de autentificare e funcțională — problema e la tokenul trimis din browser către funcție.

## Cauza cea mai probabilă a erorii

Tokenul trimis de aplicație către funcție nu mai este un token de utilizator valid (sesiune veche invalidată de restaurare → clientul cade pe cheia publică anonimă). Funcția nu distinge acest caz și răspunde cu un mesaj de „lipsă permisiuni", ascunzând cauza reală. Diagnosticul exact se confirmă în etapa 1 înainte de a modifica logica.

## Plan

### Etapa 1 — Confirmarea cauzei
1. Adaug în funcție logare diagnostică (rolul și subiectul tokenului primit, fără a expune tokenul) și rulez un apel real de editare cu o sesiune autentificată de admin, ca să văd dacă tokenul ajunge ca token de utilizator sau ca cheie anonimă.

### Etapa 2 — Corectarea erorii de editare
2. În funcție: dacă tokenul nu identifică un utilizator, răspund cu 401 și mesaj clar în română („Sesiune expirată. Reautentificați-vă.") în loc de mesajul de permisiuni.
3. În frontend (pagina de administrare utilizatori): înainte de apel se reîmprospătează sesiunea; dacă nu există sesiune validă, utilizatorul e trimis la login cu mesaj explicit, în loc de toast generic.
4. Verific și celelalte acțiuni ale funcției (creare utilizator, resetare parolă, ștergere, acces modul Portofoliu) pe același traseu, plus celelalte funcții edge care validează apelantul la fel, ca să nu rămână același comportament ascuns.

### Etapa 3 — Refacerea întăririlor pierdute la restaurare
5. Migrare care retrage de la rolul `anon` drepturile de scriere (INSERT/UPDATE/DELETE) pe toate tabelele publice, păstrând strict citirile și inserările publice necesare: evenimente publice, rezervări publice și biletele aferente.
6. Verificare că nu s-a stricat nimic: rezervare publică fără cont, autentificare elev, profesor și diriginte — citire și scriere pe fluxurile lor uzuale (rezervări, prezență, portofoliu).

### Etapa 4 — Verificare finală
7. Editez efectiv un profesor din admin și confirm salvarea în bază (nume, normă, inițiale, roluri, materii, acces Portofoliu).
8. Rulez linterul de securitate și raportez ce rămâne.

## Detalii tehnice

- Fișiere: `supabase/functions/admin-manage-users/index.ts`, pagina de administrare utilizatori din `src/pages/admin/`, plus o migrare nouă pentru revocarea drepturilor `anon`.
- Nu se modifică politicile RLS existente, doar drepturile la nivel de rol (GRANT/REVOKE) pierdute la restaurare.
