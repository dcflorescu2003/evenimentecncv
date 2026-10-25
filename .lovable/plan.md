# Raport ISMB: locație în liceu și domenii distribuite

## 1. Resurse utilizate
- Dacă evenimentul are o sală din liceu, coloana arată „C.N. Cantemir Vodă” în loc de numele sălii.
- Evenimentele din afara liceului își păstrează locația scrisă de profesor.

## 2. Domeniu pentru activitățile neclare
- Activitățile recunoscute după cuvinte cheie își păstrează domeniul ghicit.
- Celelalte nu mai primesc „Altele”. Se împart pe rând, în blocuri care alternează 3, 2, 3, 2…:
  - 3 la Managementul deșeurilor, consum și producție sustenabile
  - 2 la Păduri și viața terestră
  - 3 la Exploatarea responsabilă a resurselor naturale
  - 2 la Schimbări climatice, 3 la Energia verde, 2 la Poluare, 3 la Biodiversitate, 2 la Ape și viața acvatică, 3 la Risipă alimentară
  - apoi ciclul se reia de la Managementul deșeurilor.
- Domeniul rămâne editabil pe fiecare rând, iar tabelul rămâne ordonat pe domenii.

## Detalii tehnice
- `src/pages/manager/ISMBReportPage.tsx`: se citește `room_id` la evenimente; dacă e completat, `resurse = "C.N. Cantemir Vodă"`. `guessDomain` returnează `null` când nu recunoaște nimic, iar aceste rânduri primesc domeniul dintr-o listă ciclică cu blocurile de mai sus.
