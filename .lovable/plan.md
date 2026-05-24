## Concluzie analiză fișier `orar_elevi_S7.xml`

Fișierul este un export PDF→XML din aplicația **aSc Orare**. Structura este parsabilă programatic și se mapează aproape 1:1 pe schema actuală `class_schedules` / `schedule_entries`.

### Ce am găsit pentru Clasa V A (prima clasă, liniile 54-266)

- **Header pagină**: `<P>Clasa V A Clasa VII A ...</P>` — paginile grupează 5 clase per pagină.
- **Antet tabel ore**: 12 ore (07:30-08:20 ... 18:30-19:20), cu o **coloană fantomă** între ora 1 și ora 2 (artefact PDF — trebuie ignorată la parsare).
- **Rânduri zile**: `Lu, Ma, Mi, Jo, Vi` (L-V, fără sâmbătă) — se mapează direct la `day_of_week` 1-5.
- **Celule** de forma `Mate 5 RC` / `L.rom 5 GL` / `Info AEL DC` / `Ef sport MN`:
  - **Materie abreviată**: Mate, L.rom, Ist, Rel, Et/TI, Geo, Dirig, Bio, Info AEL, Le, Lf, Ef sport, St.s-u, Em, Ep…
  - **Cifră intermediară** (ex. "5") — pare să fie indicator de grupă/an, nu sală.
  - **Inițiale profesor**: RC, GL, IE, VON, CIS, MN, NM, DC…
- **Numele dirigintelui** apare în antetul *următorului* tabel: `<TD>Diriginte : GAVRILA RALUCA </TD>` (l.282).
- **Sala lipsește** din XML — câmpul `room` va rămâne gol.

### Exemplu extras (Clasa V A, Luni)


| Ora | Materie  | Prof |
| --- | -------- | ---- |
| 1   | Mate     | RC   |
| 2   | Le       | VON  |
| 3   | Lf       | CIS  |
| 4   | Ef sport | MN   |
| 5   | St.s-u   | NM   |


---

## Plan implementare: Import XML orar

### A. Dicționare de mapare (`src/lib/schedule-aliases.ts`)

Două hărți editabile:

1. **Materii** — abreviere → nume complet (`Mate`→`Matematică`, `L.rom`→`Limba română`, `Ef sport`→`Educație fizică`, `St.s-u`→`Studii sociale`, `Info AEL`→`Informatică AEL`, `Le`→`Limba engleză`, `Lf`→`Limba franceză`, `Et/TI`→`Etică / TIC`, `Dirig`→`Dirigenție`, `Em`→`Educație muzicală`, `Ep`→`Educație plastică`, `Rel`→`Religie`, `Bio`→`Biologie`, `Ist`→`Istorie`, `Geo`→`Geografie`).
2. **Profesori** — inițiale → nume complet (gol inițial; completat manual sau prin matching cu tabela `profiles` pe baza inițialelor `first_name`/`last_name`).

Necunoscute → se stochează abrevierea așa cum apare, marcată vizual în UI pentru completare ulterioară.

### B. Parser XML (`src/lib/import-orar-xml.ts`)

- Acceptă `File` (text/xml), parsează cu `DOMParser` în browser.
- Iterează `<Table>`-urile cu structura orar (13 coloane TH = ora). Ignoră coloana fantomă cu index 2.
- Pentru fiecare tabel:
  - Citește din `<P>` sau `<TD>Clasa …</TD>` precedent numele clasei (`Clasa V A` → `V A`).
  - Pentru fiecare TR cu `<TH>Lu|Ma|Mi|Jo|Vi`, extrage 12 celule (1 per oră).
  - Tokenizează celula: ultimul token = inițiale profesor, restul = materie (păstrând `L.rom`, `Ef sport`, `Info AEL`, `Et/TI` ca tokens multi-cuvânt prin lookup în dicționar înainte de split).
- Returnează: `{ className: string, dirigName?: string, entries: EditorEntry[] }[]`.

### C. UI admin în `SchedulesPage.tsx`

Lângă butoanele **Model CSV** / **Import CSV** se adaugă:

- **Import XML aSc** — selector de fișier `.xml`.
- După parsare, dialog cu:
  - listă clase detectate (ex. „21 clase găsite în fișier")
  - mapare automată la `classes.display_name` din DB (match exact pe "V A", "VI A" etc.) — clasele fără match sunt evidențiate și se pot ignora
  - preview cu nr. de ore/clasă și lista abrevierilor de profesori necunoscute
  - checkbox „Suprascrie orarul existent" (default ON)
  - buton **Importă selectate** — pentru fiecare clasă selectată: upsert `class_schedules` + ștergere + insert `schedule_entries` (același flux ca `persist()`).

### D. Out of scope (etapă viitoare, dacă se cere)

- Mapare automată inițiale → `profiles` (poate fi adăugată ulterior cu o tabelă `teacher_initials_map`).
- Import sală — nu există în XML.
- Sâmbătă — XML-ul nu o conține pentru această sesiune.
- Orar profesori / orar săli — etape separate ale modulului (cum era planificat).

### Fișiere de creat/modificat

- **Create**: `src/lib/schedule-aliases.ts`, `src/lib/import-orar-xml.ts`, `src/components/schedule/ImportOrarXmlDialog.tsx`.
- **Modify**: `src/pages/admin/SchedulesPage.tsx` (buton + dialog).

### Întrebare deschisă

Pentru cazurile **„Info AEL DC"** (3 tokens) sau **„L.rom 5 GL"** (cu cifră intermediară), confirmi că:

- cifra intermediară (5, 9, 10 etc.) e indicator grupă/sală virtuală și o **ignorăm** (nu o salvăm în `room`)?
- sau o stocăm în `room` ca placeholder până clarificăm cu personalul școlii?  
L.rom e limba romana (materia), 5 este sala si GL sunt initialele profesorilor. Salvam sala