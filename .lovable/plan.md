# Import concursuri din listele MEC 2026

## Ce facem
1. **Catedre noi** (pe lângă cele existente): Biologie, Educație fizică și sport, Tehnologii, Limbi materne și alte limbi moderne (germană, spaniolă, italiană, latină, neogreacă etc.), Științe socio-umane / Filosofie, Interdisciplinar, Proiecte educative. Toate concursurile din cele 4 liste își găsesc o catedră.
2. **Tip concurs** nou, ca etichetă: Internațional (categoria I/II/III), Olimpiadă națională, Concurs național finanțat MEC, Concurs fără finanțare MEC.
3. **Import** al tuturor concursurilor din cele 4 PDF-uri, cu denumiri uniformizate:
   - scrise normal (nu cu majuscule), cu diacritice corecte;
   - olimpiadele din lista națională primesc prefixul „Olimpiada de …” (ex. „MATEMATICĂ” → „Olimpiada de Matematică”; „LIMBA ENGLEZĂ” → „Olimpiada de Limba engleză”);
   - păstrăm precizările utile (clase, „gimnaziu și liceu”);
   - eliminăm dublurile (același concurs pe două liste).
4. **Căutare și filtrare la alegerea concursului** (la „Adaugă premiu”): în loc de listă simplă, un câmp de căutare (fără diacritice) cu filtre pe catedră și pe tip. Catedra rămâne pasul întâi, dar căutarea poate găsi și în toate catedrele.
5. **Admin – Concursuri**: aceeași căutare + filtre pe catedră și tip; tipul se poate seta la adăugare/editare.
6. **Rapoarte**: filtru suplimentar după tipul concursului.

## Detalii tehnice
- Migrare: valori noi în enum-ul de catedre; coloană `competitions.category` (enum, nullable).
- Lista curățată se generează din PDF-uri într-un script local, se verifică manual (eșantion) și se inserează prin interogare de date.
- Combobox (Popover + Command) cu `normalizeText` pentru căutare.
- Actualizare `DEPARTMENTS`/tipuri în `src/lib/competitions.ts` și test pentru uniformizarea denumirilor.
