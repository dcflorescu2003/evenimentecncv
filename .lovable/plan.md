# Reparare: API-ul cantinei nu trimite toți utilizatorii

## Cauza (confirmată)
Baza de date are 1040 de roluri relevante (964 elevi, 42 profesori, 34 diriginți). API-ul citește lista de roluri dintr-o singură cerere, iar serverul returnează maximum 1000 de rânduri per cerere. Ultimii ~40 de utilizatori (în ordinea ID-ului) nu ajung niciodată la cantină, indiferent de paginare.

Același risc există la citirea claselor elevilor (o cerere cu până la 1000 de elevi, mai mulți ani școlari) — poate trunchia și clasa.

## Ce schimbăm
În funcția `canteen-api`, acțiunea `/students`:
1. Citim rolurile în bucăți de câte 1000 (`.range()` în buclă) până se termină.
2. Citim profilurile și asignările la clase în bucăți de câte 200 de ID-uri, cu paginare `.range()` la asignări.
3. Adăugăm `total` în răspuns (numărul total de utilizatori), ca aplicația cantinei să poată verifica că a primit tot.
4. Actualizăm `docs/canteen-api.md` cu câmpul `total`.

## Verificare
După deploy, apelăm `/students?type=all` paginat și confirmăm că suma = 1040 (sau `type=student` = 964).

Nu e nevoie de schimbări în aplicațiile mobile; aplicația cantinei primește automat toți utilizatorii la următoarea sincronizare.
