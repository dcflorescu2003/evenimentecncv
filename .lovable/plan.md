## Diagnostic

Am verificat fluxurile de upload pentru cele trei roluri.

### 1. Profesori (teacher / homeroom_teacher) — la Dosar și Formulare
- Cod: `src/pages/prof/ProfEventDetailPage.tsx` (linia 607) → path `${event_id}/${category}/...`
- RLS storage: politica nouă `Event creators manage event files storage` (migrația din 21.05) acoperă `cse`, `teacher`, `homeroom_teacher` pe baza `is_event_creator(folder[1], auth.uid())`.
- **Status: funcționează** (după migrația deja aplicată).

### 2. Elevi — încărcare formular completat
- Cod: `src/pages/student/StudentEventDetailPage.tsx` (linia 252) → path `submissions/${event_id}/${user_id}/...`
- RLS storage existent (migrația inițială, linia 623): permite INSERT doar dacă `folder[1] = 'form-submissions'` ȘI `folder[2] = auth.uid()`.
- **Bug 1**: prefixul folosit în cod (`submissions/`) NU se potrivește cu prefixul cerut de policy (`form-submissions/`), iar ordinea (event_id înainte de user_id) e inversă față de policy. → elevii **nu pot încărca** (RLS error).
- **Bug 2**: profesorii citesc submisiile elevilor prin `createSignedUrl` pe `event-files` (`ProfEventDetailPage` linia 263). Cu path-ul actual `submissions/<event_id>/<user_id>/...`, politica „Event creators manage" cere `folder[1]` să fie un UUID de eveniment — nu este. → profesorii **nu pot descărca** formularele completate de elevi.

---

## Plan

### A. Unificare convenție de path pentru `event-files`

Schimb path-ul folosit la încărcarea formularelor de către elevi în:

```
<event_id>/form-submissions/<student_id>/<timestamp>_<filename>
```

Avantaje:
- `folder[1] = event_id` → politica existentă „Event creators manage event files storage" îi lasă pe profesori (creatorul evenimentului) să citească/descarce automat formularele elevilor.
- Folderul de submission e clar grupat sub eveniment, ca restul fișierelor (dosar, formulare-template).

### B. Migrație nouă — politici storage pentru elevi

Adaug pe `storage.objects` (bucket `event-files`):

1. **Students upload own form submissions** (INSERT, role student): permite dacă `folder[1] = event_id`, `folder[2] = 'form-submissions'`, `folder[3] = auth.uid()`, iar `event_id` aparține unui eveniment publicat (`events.published = true AND status = 'published'`).
2. **Students read own form submissions** (SELECT, role student): aceleași condiții pe folder.
3. **Students read form templates** — politica existentă (`folder[1] = 'form-templates'`) rămâne, dar nu mai e folosită — formularele-template sunt urcate de profesori la `<event_id>/form_template/...` și sunt deja acoperite de „Event creators manage" pentru read. Pentru ca elevii să le poată descărca, adaug o politică suplimentară:
   - **Students read form template files** (SELECT, role student): permite dacă `folder[2] = 'form_template'` și `event_id = folder[1]` ține de un eveniment publicat.

> Politicile vechi „Students upload form submissions to storage" / „Students read own submissions from storage" (cu prefix `form-submissions/`) le las pe loc (compatibilitate retroactivă) sau le pot șterge la cerere — recomand să le **șterg** ca să nu existe confuzie.

### C. Cod — schimbări

- `src/pages/student/StudentEventDetailPage.tsx` (linia 252): schimb path-ul în
  ```ts
  const path = `${id}/form-submissions/${user.id}/${Date.now()}_${file.name}`;
  ```
  Plus validare client-side de tip fișier (PDF / DOCX / imagini), aliniat cu profesorii.

- Niciun alt cod nu se schimbă — RLS pe tabela `form_submissions` e deja corect (elevii pot INSERT propriile rânduri, profesorii citesc prin `is_event_creator`).

### D. Verificări după aplicare

- Cu cont CSE / profesor / diriginte: upload la „Dosar" (PDF/DOCX) și „Formulare" (PDF/DOCX/imagine) — trebuie să meargă.
- Cu cont elev înscris: descarcă formular-template, urcă formular completat, vede signed URL.
- Cu cont profesor: deschide submisiile elevilor și descarcă fișierul.

## Fișiere modificate

- **Migrație nouă** `supabase/migrations/...add_storage_policies_student_submissions.sql` — 2 politici INSERT/SELECT pentru elevi pe submisii, 1 politică SELECT pentru elevi pe form templates legate de evenimente publicate. Opțional: drop politicile vechi cu prefix `form-submissions/`.
- `src/pages/student/StudentEventDetailPage.tsx` — path unificat `<event_id>/form-submissions/<user_id>/...` + validare tip fișier (PDF/DOCX/imagini, max 10MB — deja există).

## Întrebări

1. Pentru elevi, la „formular completat" accept **PDF + DOCX + imagini** (consistent cu profesorii la formulare), sau doar PDF + DOCX?
2. Șterg politicile vechi „Students upload/read form submissions to storage" (prefix `form-submissions/`), care nu mai sunt folosite, sau le las pentru compatibilitate?