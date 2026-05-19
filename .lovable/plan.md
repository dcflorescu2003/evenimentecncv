# Restructurare aplicație CNCV în module

## Verdict de complexitate

**Nu este complicat.** Pentru că alegem monolit cu rute (`/evenimente`, `/orar`, `/feedback`...), păstrăm tot ce există acum și doar adăugăm un nivel deasupra: un **hub** după login + un **registru de module** care decide ce vede fiecare rol. Codul actual nu trebuie rescris, doar mutat sub prefixul `/evenimente`.

Efort estimat:

- Faza 1 (shell + hub + config acces): mic-mediu (~1-2 iterații)
- Faza 2 (modul Orar): mediu (depinde de sursa orarului)
- Faze ulterioare (Feedback, Comunicare...): fiecare modul = un mini-proiect independent

## Arhitectura propusă

### 1. Registry de module (frontend)

Un singur fișier `src/modules/registry.ts` care declară toate modulele:

```ts
{ key: 'events', label: 'Evenimente', icon: CalendarDays, path: '/evenimente', roles: [...] }
{ key: 'schedule', label: 'Orar', icon: Clock, path: '/orar', roles: [...] }
{ key: 'feedback', label: 'Feedback', icon: MessageSquare, path: '/feedback', roles: [...] }
```

Hub-ul, meniul mobil și gardienii de rute citesc toate din acest registru. Adăugarea unui modul nou = o intrare aici + rutele lui.

### 2. Hub după login (`/app`)

Pagină nouă cu **carduri mari** per modul (titlu, iconă, scurtă descriere, badge opțional cu notificări). Click → intră în modul. Logo CNCV sus, switcher de modul disponibil și din header când ești într-un modul, ca să poți comuta fără să te întorci la hub.

Redirectarea după login se schimbă: în loc de `/student`, `/prof`, `/admin` direct → mergi la `/app` și de acolo alegi. Rolurile existente rămân neschimbate.

### 3. Acces configurabil per rol (admin)

Tabel nou `module_access` în DB:

- `module_key` (text) — ex. `events`, `schedule`, `feedback`
- `role` (app_role) — care rol primește modulul
- `enabled` (bool)

Admin are o pagină nouă `/admin/modules` cu matrice rol × modul (checkboxuri). RLS: toți autentificații pot citi, doar admin scrie. Frontend-ul filtrează registry-ul cu această configurație înainte să randeze hub-ul/meniul.

Avantaj: când adaugi un modul nou, nu trebuie deploy ca să-l activezi pentru un rol — îl bifezi din admin.

### 4. Modulele existente devin "modul Evenimente"

Mutăm rutele actuale (`/student`, `/prof`, `/teacher`, `/coordinator`, `/manager`, `/admin`) sub prefixul `/evenimente/{rol}` SAU păstrăm rutele actuale și le marcăm pur și simplu ca aparținând modulului `events` în registry. **Recomand a doua variantă** — zero risc de regresie, zero linkuri/biletele/QR-uri sparte, zero modificări la edge functions sau emailuri care conțin URL-uri.

Ce se schimbă efectiv în cod pentru modulul existent: doar layout-urile (header) capătă un buton "← Înapoi la module" care duce la `/app`.

### 5. Primul modul nou: Orar

Structură minimă:

- Tabele DB: `schedule_periods` (ora 1..8 cu start/end), `schedule_entries` (class_id, day_of_week, period, subject, teacher_id, room)
- Rute: `/orar` (elevii văd orarul clasei lor; profesorii văd al lor)
- Import: CSV sau formular admin

Înainte de implementare am nevoie de detalii: sursa orarului (CSV de la secretariat? introducere manuală? Aspen/altceva?), granularitate (semestru/săptămână par-impar?), excepții (zile speciale).

## Plan în pași

1. **Shell + registry + hub** (`/app`) și redirect post-login. Modulul `events` apare în hub cu toate rutele existente intacte.
2. **Tabel `module_access` + pagină admin** pentru activare per rol.
3. **Modul Orar** — DB + pagini elev/profesor + import.
4. **Modul Feedback** — schema generică de chestionare (formulare + întrebări + răspunsuri), tipuri: feedback profesori, sugestii evenimente, recrutare voluntari.
5. Modulele viitoare (Comunicare, Management) — fiecare urmează același tipar: registry entry + tabele + pagini.

## Detalii tehnice (pentru referință)

```text
src/
  modules/
    registry.ts          # lista modulelor + roluri permise
    useEnabledModules.ts # hook care combină registry + module_access din DB
  pages/
    AppHub.tsx           # /app — cardurile cu module
  components/
    layouts/
      ModuleSwitcher.tsx # buton header pentru întors la /app
```

Rutele existente rămân exact unde sunt; doar `ProtectedRoute` adaugă o verificare suplimentară `moduleEnabled('events', role)` pentru a respecta `module_access`.

## Ce vreau să confirmi înainte să încep

- OK cu păstrarea rutelor existente (`/student`, `/prof`...) sub umbrela modulului `events`, fără a le redenumi în `/evenimente/...`? (recomandat)
- Hub-ul `/app` să fie noua destinație implicită după login pentru toate rolurile (inclusiv admin)?
- Pentru `module_access`: vrem și granularitate per utilizator individual sau doar per rol e suficient?  
  
Ok cu păstrarea rutelor existente  
Hub-ul `/app` să fie noua destinație implicită după login, inclusiv pentru admin, dar el va vedea mai multe lucruri  
Pentru `module_access`:  per rol e suficient  
  
Nu as vrea sa implementam azi. Poti tine minte planul si sa il implementam mai tarziu?