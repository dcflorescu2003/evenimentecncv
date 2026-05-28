## Obiectiv

Sincronizez datele din cele două PDF-uri (`orar_elevi_S7.pdf` cu inițiale + `Orar Cosmin.pdf` cu nume complete) astfel încât:

1. Toate cele 29 de clase (V A … XII E) să aibă orarul corect importat în `class_schedules` + `schedule_entries`.
2. Inițialele din orar (RC, GL, VON, BAI etc.) să fie legate de conturile reale din `profiles.initials`, ca Feedback Profesori să afișeze pe fiecare clasă **exact profesorii ei**.
3. Să primești un raport clar cu profesorii care apar în PDF dar nu au cont în aplicație, ca să decizi tu cum îi adaugi.

## Ce am extras deja din PDF-uri

- **29 diriginți** identificați cu nume complet (ground truth, din antetul fiecărei pagini).
- **57 inițiale** distincte apărute în celulele tabelelor.
- **811 perechi (clasă, zi, oră) → celulă** aliniate poziție-cu-poziție între cele două PDF-uri.

Datorită modului în care PDF-ul Cosmin „rupe" numele lungi pe două rânduri, ~15 din cele 57 mapări inițiale→nume vor avea nevoie de reparare deterministă (combin cu lista diriginților + materie + secțiune ca disambiguator).

## Pași (în această ordine)

### 1. Script de extracție definitivă (offline, în sandbox)

Generez un singur CSV `teachers_mapping.csv` cu coloanele:

```
initials, full_name, source, classes_taught, subjects_taught, match_status
```

unde `match_status` ∈ {`diriginte_confirmat`, `nume_complet_extras`, `nume_partial_de_reparat`, `fara_match_in_profiles`}. Folosesc:
- antetul de pagină pentru diriginți (sigur);
- comparația celulă-cu-celulă pentru restul;
- fallback: caut în text numele complet care conține cel mai des fragmentul rupt.

Apoi încrucișez cu `profiles` (rol teacher/homeroom_teacher/coordinator_teacher) după (a) `initials` deja completate, (b) potrivire fuzzy pe `last_name + first_name`. Output: două raporte CSV în `/mnt/documents/`:
- `mapare_initiale_profesori.csv` — toate cele 57 cu nume + status match;
- `profesori_lipsa_din_aplicatie.csv` — cei care nu au cont încă (cu lista claselor/materiilor predate).

**Te opresc aici** ca să confirmi/corectezi CSV-urile înainte să scriu în DB.

### 2. Backfill `profiles.initials` (după confirmarea ta)

Migrare simplă (`UPDATE profiles SET initials = ... WHERE id = ...`) sau, dacă e mai practic, o pagină Admin nouă „Mapare inițiale" cu tabel editabil — alegerea o facem după ce vezi CSV-ul.

Pentru profesorii fără cont: rămân doar în raport, nu îi creez automat. Îi adaugi tu manual din Admin → Utilizatori, iar apoi le completezi inițialele.

### 3. Import orar pentru toate 29 clasele

Reutilizez componenta existentă `ImportOrarXmlBulkDialog` + parserul `extractClassSchedule`. Dar:
- PDF-ul S7 nu este XML aSc, e PDF tipărit. **Nu pot folosi direct importerul XML** — am nevoie ca tu să exporți același orar ca XML din aSc (format identic cu `Orar_Cosmin.xml` pe care l-ai dat ieri), sau îmi confirmi că folosesc XML-ul aSc deja încărcat (`Orar_Cosmin.xml`) care conține inițialele.
- Alternativ, scriu un parser dedicat care extrage celulele din PDF-ul S7 (logica e deja prototipată — 811 celule deja parsate corect) și produce același `EditorEntry[]` ca importerul XML, apoi rulez importul în bulk pentru toate clasele într-un singur ecran de confirmare.

Recomand: **scriu parserul de PDF** (extragere prin pdfplumber pe server nu merge — fac varianta browser cu `pdfjs-dist` care e deja disponibilă în proiect, sau accept XML-ul aSc dacă îl ai). Confirmă-mi una din variante când răspunzi.

### 4. Verificare Feedback Profesori

După import, `FeedbackFillPage` rezolvă deja profesorii unei clase din `schedule_entries` + `get_teacher_initials_map`. Verific manual pe 2-3 clase (V A, IX A, XII C) că lista profesorilor afișați este corectă (nume complete, fără duplicate, fără inițiale neasignate).

## Detalii tehnice

- Maparea inițialelor → nume e dependentă de PDF; o salvez ca date, nu ca cod hardcodat. Sursa unică de adevăr rămâne `profiles.initials`.
- Materiile sunt normalizate prin `applySubjectAlias` (există deja).
- Nu modific `schedule_entries.teacher_name` automat: orarul stochează inițialele, iar UI-ul afișează numele complet prin lookup la render (mecanismul existent „Teacher Initials").
- Nu creez conturi de teacher automat (per răspunsul tău). Raportul îți spune exact pe cine să adaugi.
- Toate scrierile în DB se fac doar după confirmarea ta a CSV-ului.

## Întrebare blocantă înainte de implementare

Pentru pasul 3 (importul orarului): ai disponibil **XML-ul aSc cu orarul cu inițiale** (echivalentul lui `Orar_Cosmin.xml` dar pentru S7)? Dacă da, importul devine trivial cu unealta existentă. Dacă nu, scriu un parser PDF dedicat — funcționează, dar adaugă cod nou.