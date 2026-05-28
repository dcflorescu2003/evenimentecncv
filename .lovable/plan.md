## 1) Logo "CNCV" devine buton către hub-ul de module

În toate layout-urile cu antet (`StudentLayout`, `ProfLayout`, `TeacherLayout`, `CoordinatorLayout`, `ManagerLayout`, `AdminLayout`) blocul `<GraduationCap /> CNCV …` devine un `<button>` care navighează la `/app`. Stilizare neschimbată, doar wrapper cu `cursor-pointer hover:opacity-80`, `aria-label="Toate modulele"`.

## 2) `ModuleSwitcher` afișează modulul curent corect

Acum funcția `current` recunoaște doar `events`/`schedule`. O extind ca să detecteze pe baza prefixului de cale toate cele 4 module:

```text
/admin/feedback, /prof/feedback, /student/feedback        → feedback
/admin/clubs, /prof/clubs, /student/clubs, /student/volunteer → clubs_volunteer
/admin/schedules, /student/orar                           → schedule
restul (/admin, /student, /prof, /coordinator, /manager)  → events
```

Logica devine o mică funcție `detectCurrentKey(pathname)` cu lista de prefixe per `module.key`, după care `current = modules.find(m => m.module.key === detected)`.

## 3) Chestionarele anonime apar ca "completate"

**Cauză:** la trimitere anonimă, `feedback_responses.respondent_id` rămâne NULL prin design, deci pagina elevului nu mai poate filtra după `respondent_id = user.id`.

**Soluție:** tabel nou de evidență `feedback_completions`, separat de răspunsuri (fără date, doar marker).

Migrație:
```sql
CREATE TABLE public.feedback_completions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  form_id uuid NOT NULL REFERENCES public.feedback_forms(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  subject_teacher_id uuid,
  completed_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (form_id, user_id, subject_teacher_id)
);
GRANT SELECT ON public.feedback_completions TO authenticated;
GRANT ALL ON public.feedback_completions TO service_role;
ALTER TABLE public.feedback_completions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own completions" ON public.feedback_completions
  FOR SELECT TO authenticated USING (user_id = auth.uid());
```

Actualizez `submit_feedback_response` să facă `INSERT … ON CONFLICT DO NOTHING` în `feedback_completions` pentru `_uid` la fiecare submit (anonim sau identificat), folosind `subject_teacher_id` când e cazul.

În `StudentFeedbackPage`:
- `myResponses` rămâne pentru cele identificate (cu butonul "Editează").
- adaug un al doilea query `myCompletions` din `feedback_completions` join cu `feedback_forms`.
- în "Feedbackul meu" afișez reuniunea: cele identificate cu opțiunea Editează; cele anonime cu badge "Anonim" + "Final" și data din `completed_at` (fără link de editare).
- în "Chestionare deschise" markez ca închise pe baza `(form_id, subject_teacher_id)` din completări (înlocuiește `respondedKeys` actual).

## 4) Calendarul din `DateInput` nu se deschide (preview iframe)

**Cauză:** `input.showPicker()` aruncă `SecurityError` din iframe cross-origin (preview-ul Lovable). În producție merge, dar preview-ul rămâne nefuncțional.

**Soluție:** elimin dependența de `showPicker` și folosesc `<Popover>` + `<Calendar>` (shadcn, deja prezent), care merge oriunde. Păstrez și input-ul text cu format `zz.ll.aaaa`.

Schiță:
```tsx
<Popover>
  <PopoverTrigger asChild>
    <button><CalendarDays /></button>
  </PopoverTrigger>
  <PopoverContent align="end" className="p-0">
    <Calendar mode="single" selected={value ? new Date(value) : undefined}
      onSelect={(d) => d && onChange(format(d, "yyyy-MM-dd"))} />
  </PopoverContent>
</Popover>
```
Înlătur `hiddenRef` și `showPicker`. Locale `ro` pentru calendar.

## 5) Diacritice în PDF

`exportReportPdf` (`src/lib/report-pdf.ts`) elimină explicit diacriticele (`stripDiacritics`), iar `feedback-pdf.ts` folosește fontul `helvetica` (Latin-1), care nu suportă glifele românești.

**Soluție:** embed font Unicode (Noto Sans / DejaVu Sans) în jsPDF.

- Adaug `src/lib/pdf-font.ts` cu funcția `ensureUnicodeFont(doc)` care, la prima utilizare, încarcă un TTF (de ex. `noto-sans-regular.ttf` și `noto-sans-bold.ttf`) plasat în `public/fonts/`, apoi `doc.addFileToVFS(...)` + `doc.addFont(..., "NotoSans", "normal"/"bold")` și setează `doc.setFont("NotoSans")`.
- Înlocuiesc `stripDiacritics(...)` din `report-pdf.ts` cu textul brut și apelez `ensureUnicodeFont(doc)` la început; același lucru în `feedback-pdf.ts` (inclusiv pentru `autoTable` prin `styles: { font: "NotoSans" }`).
- Verific că `attendance-pdf.ts` (folosit deja la alte rapoarte) primește același tratament dacă folosește același pattern.

Fonts: pun fișierele TTF în `public/fonts/` și le fetch la cerere (lazy) pentru a nu mări bundle-ul.

## Fișiere atinse

- `src/components/layouts/{Student,Prof,Teacher,Coordinator,Manager,Admin}Layout.tsx` (1)
- `src/components/ModuleSwitcher.tsx` (2)
- migrație SQL nouă + edit `submit_feedback_response` (3)
- `src/pages/feedback/StudentFeedbackPage.tsx` (3)
- `src/components/ui/date-input.tsx` (4)
- `src/lib/pdf-font.ts` (nou), `src/lib/report-pdf.ts`, `src/lib/feedback-pdf.ts`, `public/fonts/noto-sans-*.ttf` (5)

## În afara scopului

- Restructurarea navigării bottom-bar pentru module.
- Tracking pentru completări retroactive (existente înainte de migrație).
