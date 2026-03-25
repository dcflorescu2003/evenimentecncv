

## Plan: Fix buton "Scanează" invizibil pe iPhone pentru asistenți

### Problema
În `StudentDashboard.tsx`, cardul asistentului (liniile 238-264) folosește un layout `flex justify-between` pe o singură linie. Pe iPhone (~375px), rândul conține:
- Stânga: titlu + badge "Asistent"  
- Dreapta: buton "Scanează" + badge "Prezent"

Spațiul este insuficient, iar butonul fie este comprimat, fie este tăiat de overflow.

### Soluție
**Fișier: `src/pages/student/StudentDashboard.tsx`**
- Schimbă layout-ul cardului asistentului din dashboard de la un singur rând la un layout stacked pe mobile:
  - Rândul 1: titlu eveniment + badge "Asistent" + badge "Prezent" (dreapta)
  - Rândul 2: data/ora + buton "Scanează" (full-width sau aliniat dreapta)
- Concret: `flex flex-col` pe container, cu un sub-rând pentru acțiuni care se afișează sub informații pe ecrane mici
- Alternativ mai simplu: `flex flex-wrap` pe container-ul principal, permițând elementelor să se mute pe rândul următor

### Detalii tehnice
Modificare doar în `StudentDashboard.tsx`, secțiunea `assistantAssignments.map()` (liniile 238-264):
- Înlocuiesc `flex items-center justify-between` cu `flex flex-col gap-2`
- Prima linie: titlu + badge-uri
- A doua linie: data/ora + buton Scanează (aliniat dreapta)
- Butonul "Scanează" va fi vizibil pe toate dimensiunile de ecran

Nu sunt necesare modificări de backend sau migrări.

