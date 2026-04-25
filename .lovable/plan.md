## Plan: Optimizare mobilă pentru Calendar evenimente

Am verificat layout-ul pe viewport 390×844 (iPhone). Vizualizarea **Lună** și **Zi** arată bine. Vizualizarea **Săptămână** are o problemă: pe mobil cele 7 zile devin 7 carduri verticale înalte (~150px fiecare), iar zilele goale ocupă același spațiu cât zilele cu evenimente — total ~1000px de scroll doar pentru 7 zile, multe goale.

### Modificări

**`src/components/student/EventsCalendar.tsx`** — funcția `renderWeek()`

Pe mobil, fiecare zi devine un **rând orizontal compact**: eticheta zilei (ex: „L 20") la stânga pe lățime fixă, iar evenimentele în dreapta. Zilele goale rămân pe un singur rând (în loc de un card de 100px). Pe desktop (`sm:` și mai sus), comportamentul actual de 7 coloane verticale rămâne neschimbat.

Concret:
- Containerul zilei: `flex gap-2` (orizontal, mobil) → `sm:flex-col sm:min-h-[100px]` (vertical, desktop)
- Eticheta zilei: lățime fixă `w-12` pe mobil pentru aliniere
- Zilele goale primesc `opacity-60` pe mobil ca să fie vizual subordonate

Restul vizualizărilor (Lună, Zi, Dialog) sunt deja optimizate corect pentru mobil — nu necesită modificări.

### Fișiere modificate
- `src/components/student/EventsCalendar.tsx` — doar funcția `renderWeek()`