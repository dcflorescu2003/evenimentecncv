## Context (diagnostic)

1. **Eroare „new row violates row-level security policy"** la upload CSE: bucket-ul `event-files` are politică `INSERT/ALL` doar pentru `admin`. Nu există politici de storage pentru `cse`, `teacher` sau `homeroom_teacher` — deci nici profesorii nu pot încărca în prezent, doar adminul. RLS-ul pe tabela `event_files` este OK pentru CSE (există deja policy "CSE manage event files"), problema e exclusiv la `storage.objects`.
2. **Cerere needitabilă**: textul de bază din `CerereTab.tsx` (paragrafele „Biroul Executiv…" și „Propunerea este ca evenimentul…" + formula de încheiere) e hardcodat. Doar câmpurile (titlu, data, ora, locație, președinte, R.N.E.B., director) sunt editabile.
3. **Validare tip fișier la upload**: actualmente în `ProfEventDetailPage.handleFileUpload` nu există nicio restricție pe tip — input-ul `<input type="file">` nu are `accept`, iar logica nu verifică extensia/MIME.

---

## Plan

### 1. Permisiuni storage pentru CSE (și profesori)

Migrație nouă cu politici pe `storage.objects` pentru bucket-ul `event-files`, care permit `INSERT/UPDATE/DELETE/SELECT` dacă:

- user-ul are rol `cse`, `teacher` sau `homeroom_teacher`, ȘI
- primul segment din path este `<event_id>` al unui eveniment creat de el (folosind `is_event_creator`).

Path-ul folosit deja în cod (`${id}/${uploadCategory}/${Date.now()}_${file.name}`) se potrivește perfect — `(storage.foldername(name))[1] = event_id`.

Asta rezolvă atât upload-ul CSE (cerere + dosar + formulare), cât și un bug similar pentru profesori (dacă apare).

### 2. Validare tip fișier (client-side)

În `ProfEventDetailPage.handleFileUpload` și pe input-ul `<input type="file">` din dialog:

- **Dosar / Cerere** (`uploadCategory === "event_dossier"`): acceptă doar `.pdf` și `.docx`
  - `accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"`
  - validare în handler: respinge cu toast clar dacă tipul nu se potrivește.
- **Formulare** (`uploadCategory === "form_template"`): acceptă PDF, DOCX **și imagini** (`.pdf,.docx,image/*`).
  - validare similară.

`accept` se setează dinamic în funcție de `uploadCategory`, care e deja în state.

### 3. Cerere — text editabil + persistat în DB

Două opțiuni; recomandare: **opțiunea A** (mai simplu, fără DB).

**A. Doar editare locală (recomandat)**

Înlocuim paragrafele hardcodate în `CerereTab` cu 2 `<Textarea>`-uri pre-completate cu textul default și interpolate cu placeholderi `{titlu}`, `{data}`, `{ora}`, `{locatie}`:

- `Textarea` „Corp introductiv" — default:
  > „Biroul Executiv al Consiliului Școlar al Elevilor din Colegiul Național „Cantemir-Vodă", vă adresează prezenta cerere prin care se solicită aprobarea organizării în cadrul colegiului nostru a unui eveniment cu titlul {titlu}."
- `Textarea` „Corp propunere" — default:
  > „Propunerea este ca evenimentul să aibă loc în data de {data}, ora {ora}, locația fiind {locatie}. Prezenți vor fi elevii care s-au înscris la eveniment prin intermediul platformei de evenimente CNCV."
- `Textarea` „Formula de încheiere" (opțional) cu cele 2 linii bold de final.

La preview și la generarea PDF, fac `replace` pe placeholderi cu valorile curente (păstrând bold doar pentru valorile interpolate, ca acum). Toate cele 3 textarea-uri devin parametri pentru `renderRuns(...)` în PDF — sparg textul pe `{placeholder}` ca să mențin bold pe valorile dinamice.

**Avantaje**: zero schimbări de schemă, zero migrații.
**Dezavantaj**: dacă schimbă pagina, textul revine la default. Pentru cazul nostru (generezi PDF imediat) e acceptabil.

**B. Persistă per eveniment** (dacă vrei să rețină textul între sesiuni): tabelă nouă `event_cerere` (event_id PK, intro_text, body_text, closing_text, president, reg_number, director) cu RLS identic ca `event_files` pentru CSE. Mai multă muncă; spune dacă vrei B.

### 4. Acceptare CSE și pentru tab-ul „Dosar / Cerere"

Verificare rapidă a logicii: `isCse` controlează deja afișarea sub-tab-ului „Cerere" lângă „Dosar". După ce storage primește politicile noi, butonul „Încarcă document" din sub-tab-ul „Dosar" și din „Formulare" va funcționa pentru CSE.

---

## Fișiere modificate

- **Migrație nouă** `supabase/migrations/...add_storage_policies_event_files_non_admin.sql` — 4 politici pe `storage.objects` (INSERT/UPDATE/DELETE/SELECT) pentru roluri `cse`, `teacher`, `homeroom_teacher`, restrânse la `event_id` propriu.
- `**src/components/cse/CerereTab.tsx**` — 3 Textarea-uri noi (intro/body/closing) cu defaulturi și placeholderi `{titlu}`, `{data}`, `{ora}`, `{locatie}`; preview + export PDF folosesc textul editat (split pe placeholderi pentru a păstra bold pe valori).
- `**src/pages/prof/ProfEventDetailPage.tsx**` — `accept` dinamic pe input fișier + validare MIME/extensie în `handleFileUpload` + mesaje toast clare.

## Întrebări

1. Pentru text editabil pe cerere: **A** (doar local, fără persistare) sau **B** (persistă în DB)?
2. La formulare, „inclusiv poze" înseamnă **PDF + DOCX + imagini**, sau **orice tip** (PDF, DOCX, imagini, XLSX, etc.)?  
  
1. Doar local  
2. **PDF + DOCX + imagini**