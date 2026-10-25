# Raport ISMB după modelul „Săptămâna verde”

Pagina Raport ISMB (manager) se reface după modelul atașat. Toate câmpurile rămân editabile, pre-completate din datele sesiunii selectate.

## Secțiunea 1 – Date generale (editabile)
1. Unitatea și localitatea: „Colegiul Național «Cantemir-Vodă», București”
2. Județul: „București”
3. Perioada: din datele sesiunii (zz.ll.aaaa – zz.ll.aaaa)
4. Nr. total elevi: elevi unici înscriși + vizitatori (ca acum)
5. Nr. total cadre didactice: profesori unici coordonatori/organizatori
- An școlar: 2026–2027 (din sesiune)
6. Reușite / puncte tari, 7. Dificultăți / puncte slabe, 8. Soluții / oportunități: text pre-completat din SWOT-ul existent

## Secțiunea 2 – Centralizator activități (tabel editabil)
- Un rând pentru fiecare eveniment publicat/încheiat din sesiune.
- Coloane: Domeniu (listă cu cele 10 domenii din model), Nivel de învățământ (Gimnaziu / Liceu / Gimnaziu și liceu, din clasele eligibile), Denumire/descriere (titlu + descriere scurtă), Nr. elevi (participanți), Nr. cadre didactice (coordonatori), Parteneri: părinți / comunitate locală / ONG-uri / alți parteneri (implicit 0), Resurse utilizate (locația).
- Domeniul se propune automat după cuvinte cheie din titlu/descriere (ex. „deșeuri, reciclare” → Managementul deșeurilor; „apă” → Ape; altfel „Altele”) și poate fi schimbat manual.
- Rânduri grupate pe domeniu în ordinea din model; se pot adăuga/șterge rânduri.

## Semnături
- Director și Coordonator program (editabile).

## Export
- PDF A4 cu antetul „ISMB • Dialogul proiectelor educative 2026–2027”, titlul, tabelul de date generale, centralizatorul (landscape pentru tabel), nota și semnăturile, cu diacritice.
- Opțional și export Word (.docx) în același format, ca să poată fi trimis direct.

## Detalii tehnice
- Fișier: `src/pages/manager/ISMBReportPage.tsx`; date paginate cu `fetchInChunks`; PDF cu fontul existent din `src/lib/pdf-font.ts` + jspdf-autotable; DOCX cu pachetul `docx`.
- Editările se păstrează doar în pagină (nu se salvează în baza de date).
