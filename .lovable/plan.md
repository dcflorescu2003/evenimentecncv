## Obiectiv

Adăugare buton "Import XML — toate clasele" în pagina admin `/admin/schedules` care preia un singur fișier XML aSc (cum este `orar_elevi_S7-2.xml`) și importă orarul pentru toate cele 32 de clase într-o singură operație.

## Maparea numelor de clase XML → DB

XML conține etichete `Clasa <roman> <litera>`. Mapare folosind `grade_number` + `section` din `classes`:

```text
roman(grade_number) + " " + (section ?? "A")  →  caută în XML eticheta "Clasa <roman> <section|A>"
```

- Gimnaziu (grade 5–8, section NULL) → "Clasa V A", "Clasa VI A", "Clasa VII A", "Clasa VIII A" (XML are doar varianta A pentru gimnaziu)
- Liceu (grade 9–12, section A–G) → "Clasa IX A" … "Clasa XII G"

Funcția existentă `extractClassSchedule(xmlText, "V A")` returnează deja `EditorEntry[]`. O refolosesc pentru fiecare clasă.

## Modificări

### 1. `src/components/schedule/ImportOrarXmlDialog.tsx`
Adaug un mod nou „Toate clasele" (toggle / tab nou în dialog, sau buton separat — vezi pct. 2). Acesta:
- Parsează XML-ul o singură dată.
- Pentru fiecare `ClassRow` primit prin prop (sau o listă încărcată intern), calculează numele așteptat în XML, apelează `extractClassSchedule`, și agregă rezultatele.
- Arată un preview: tabel cu clasa, etichetă XML, nr. ore găsite, status (✓ găsită / ⚠️ lipsă / ⛔ 0 ore).
- La confirmare apelează un nou prop `onBulkImport(results)` care primește `{ classId, entries }[]`.

Sau, mai curat: creez un dialog separat `ImportOrarXmlBulkDialog.tsx` ca să nu complic UI-ul existent.

### 2. `src/pages/admin/SchedulesPage.tsx`
- Adaug în antetul listei de clase un buton „Import XML — toate clasele" (lângă titlul „Orare clase").
- La click → deschide noul dialog bulk.
- La confirmare:
  - Pentru fiecare clasă cu entries găsite:
    - Upsert în `class_schedules` (creează dacă nu există, păstrează id-ul existent).
    - Șterge `schedule_entries` existente pentru acel `schedule_id`.
    - Inserează entries noi.
  - Folosesc batching (un singur `insert` cu toate entries-urile concatenate per schedule, sau toate într-un singur insert global cu `schedule_id` pe rând).
  - Toast: „X clase importate, Y ore în total, Z clase fără date".
  - Reîncarcă lista (`loadClasses`).

### 3. Roman conversion
Adaug helper local în dialog/page:
```ts
const ROMAN: Record<number,string> = {5:"V",6:"VI",7:"VII",8:"VIII",9:"IX",10:"X",11:"XI",12:"XII"};
const xmlKey = (grade:number, section:string|null) => `${ROMAN[grade]} ${section ?? "A"}`;
```

## Fără modificări la

- `src/lib/import-orar-xml.ts` (folosesc funcțiile existente)
- Schema DB
- Tabela `class_schedules` / `schedule_entries`

## Edge cases

- Clase fără orar găsit în XML → raportate în preview și sărite, fără eroare.
- Clase deja cu orar în DB → suprascriere completă (la fel ca importul individual existent), cu un checkbox „Suprascrie orarele existente" implicit bifat.
- Erori parțiale: continuă cu următoarea clasă, raportează la final.
