## Plan: Calendar evenimente în Panoul Principal al elevului

### Ce se adaugă

O nouă secțiune „Calendar evenimente" inserată în `src/pages/student/StudentDashboard.tsx` între prima secțiune (progresul pe sesiuni) și a doua (Rezervările tale recente). Calendarul oferă o vizualizare cronologică pe **Zi / Săptămână / Lună** a tuturor evenimentelor eligibile pentru elev.

### Funcționalități

**1. Toggle pentru vizualizare**
- Trei butoane (Tabs): „Zi" / „Săptămână" / „Lună"
- Implicit: vizualizarea „Lună"
- Navigare cu săgeți ‹ › (anterior / următor) + buton „Azi" pentru reset rapid

**2. Vizualizarea Lună (compact)**
- Grid 7×6 (tip calendar standard) cu nume zile (L Ma Mi J V S D)
- Pe fiecare zi cu evenimente: punct(e) colorate sau un mic badge cu numărul de evenimente (ex: „•3" sau cerc cu cifră)
- Culori semantice:
  - **Albastru** = eveniment disponibil (poate rezerva)
  - **Verde** = elevul are deja rezervare confirmată
  - **Gri** = eveniment trecut sau plin
- Click pe o zi → deschide popover/dialog cu lista evenimentelor din ziua respectivă (titlu, oră, locație, status)
- Click pe un eveniment din listă → navighează la `/student/events/{id}`

**3. Vizualizarea Săptămână**
- 7 coloane (zilele săptămânii curente) cu numele și data în antet
- Sub fiecare zi, lista verticală a evenimentelor din ziua respectivă (carduri compacte: titlu + interval orar + locație)
- Click pe card → navighează la pagina evenimentului

**4. Vizualizarea Zi**
- O singură zi afișată în detaliu, cu toate evenimentele listate cronologic
- Carduri mai mari, cu descriere scurtă, durată, locuri rămase, badge status
- Click pe card → navighează la pagina evenimentului

### Sursa de date

Reutilizează aceeași logică din `StudentEventsPage.tsx`:
- Query: `events` filtrate pe `status='published'`, `published=true`, `is_public=false`
- Filtrare client-side pe eligibilitate (`eligible_classes` / `eligible_grades` vs clasa elevului)
- Include și evenimentele unde elevul are deja rezervare (din `reservations`)
- Folosește `get_events_reserved_counts` RPC pentru locuri ocupate

În calendarul lunar, per perioadă vizibilă filtrăm evenimentele după `event.date` în interval.

### UX & îmbunătățiri sugerate

- **Legendă mică sub calendar** (3 puncte colorate cu etichete: „Disponibile" / „Rezervate de tine" / „Trecute/Pline")
- **Indicator „azi"**: ziua curentă marcată cu border accentuat
- **Counter în antet**: „X evenimente în această lună/săptămână"
- **Empty state**: mesaj prietenos când nu sunt evenimente în perioadă („Niciun eveniment programat în această perioadă")
- **Dialog detaliat pe lună**: când dai click pe o zi cu mai multe evenimente, se deschide un Dialog cu lista completă, fiecare cu buton „Vezi detalii" care duce la pagina evenimentului
- **Responsive**: pe mobil (viewport <768px), vizualizarea Lună reduce textul la doar puncte colorate; vizualizarea Săptămână devine scrollabilă orizontal sau colapsează în listă verticală grupată pe zile

### Detalii tehnice

- Componentă nouă: `src/components/student/EventsCalendar.tsx` care primește `events: Event[]` și `myReservationIds: Set<string>` ca props
- State intern: `view: 'day' | 'week' | 'month'`, `currentDate: Date`
- Helper-i pentru navigare dată: `addDays`, `addWeeks`, `addMonths`, `startOfMonth`, `startOfWeek` (folosind `date-fns` care e deja instalat — verificat în alte fișiere `format`)
- Fără modificări DB; toate query-urile sunt SELECT pe tabele cu RLS deja configurat pentru elevi
- Fără edge functions noi
- Romanian locale: nume zile/luni în limba română (constante locale, nu importăm `date-fns/locale` pentru simplitate)

### Fișiere modificate / create

- **Creat**: `src/components/student/EventsCalendar.tsx` — componenta calendar cu cele 3 view-uri
- **Modificat**: `src/pages/student/StudentDashboard.tsx` — adaugă query pentru evenimente eligibile + integrare componentă între cele două secțiuni existente