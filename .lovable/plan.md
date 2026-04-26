## Obiectiv

Adăugare workflow complet pentru CSE de gestionare documente eveniment (Dosar/Cerere + Formulare) și tracking al submisiilor formularelor de la elevi/părinți, cu statusuri: încărcat / verificat / acceptat / respins.

CSE folosește deja `ProfEventDetailPage.tsx` (rute `/prof`), deci modificările se fac în această pagină comună, condiționat pe rol.

## Modificări UI

### 1. Tab "Dosar / Cerere" (CSE) vs "Dosar" (profesor)

În `ProfEventDetailPage.tsx`, când `isCse === true`:
- Eticheta tabului devine **"Dosar / Cerere"** (în loc de "Dosar eveniment")
- Eticheta categoriei `event_dossier` în dialogul de upload devine **"Dosar / Cerere"**
- Restul comportamentului identic (upload, listă, descărcare, ștergere)

Pentru profesor rămâne neschimbat: "Dosar eveniment".

### 2. Tab "Formulare" — extins cu tracking submisii

Tabul existent "Formulare" (șabloane încărcate de organizator) primește o secțiune nouă dedesubt: **"Formulare primite de la elevi / părinți"**.

Această secțiune este vizibilă pentru CSE, profesor coordonator și diriginte (creatorul evenimentului). Conține:
- Listă agregată din `form_submissions` filtrată pe `event_id`
- Coloane: Elev, Titlu formular, Fișier (download), Data încărcării, Status (badge colorat), Acțiuni
- Buton de schimbare status pentru fiecare submisie:
  - `uploaded` (gri) → "Marchează verificat"
  - `reviewed` (albastru) → "Acceptă" / "Respinge"
  - `accepted` (verde) / `rejected` (roșu) → "Resetează la verificat"
- Câmp opțional pentru `admin_notes` la respingere

### 3. Badge "Eveniment CSE" în tab Formulare

Pentru claritate, dacă evenimentul este CSE, secțiunea Formulare afișează `<CseBadge />` lângă titlu.

## Modificări baza de date

### Migrație: extind enum `form_submission_status`

Verific valorile existente — adaug `reviewed` dacă lipsește (există deja `uploaded`, `accepted`, `rejected` pe baza componentelor existente).

```sql
ALTER TYPE public.form_submission_status ADD VALUE IF NOT EXISTS 'reviewed';
```

### Migrație: RLS pentru `form_submissions`

Politici noi pentru a permite organizatorului evenimentului (CSE / profesor / diriginte) să citească și să actualizeze submisiile elevilor pentru evenimentele lor:

```sql
-- Citire submisii pentru creatorul evenimentului
CREATE POLICY "CSE read event submissions" ON public.form_submissions
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'cse') AND is_event_creator(event_id, auth.uid()));

CREATE POLICY "Teachers read event submissions" ON public.form_submissions
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'teacher') AND is_event_creator(event_id, auth.uid()));

CREATE POLICY "Homeroom teachers read event submissions" ON public.form_submissions
FOR SELECT TO authenticated
USING (has_role(auth.uid(), 'homeroom_teacher') AND is_event_creator(event_id, auth.uid()));

-- Update status submisii pentru creatorul evenimentului
CREATE POLICY "CSE update event submissions" ON public.form_submissions
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'cse') AND is_event_creator(event_id, auth.uid()))
WITH CHECK (has_role(auth.uid(), 'cse') AND is_event_creator(event_id, auth.uid()));

CREATE POLICY "Teachers update event submissions" ON public.form_submissions
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'teacher') AND is_event_creator(event_id, auth.uid()))
WITH CHECK (has_role(auth.uid(), 'teacher') AND is_event_creator(event_id, auth.uid()));

CREATE POLICY "Homeroom teachers update event submissions" ON public.form_submissions
FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'homeroom_teacher') AND is_event_creator(event_id, auth.uid()))
WITH CHECK (has_role(auth.uid(), 'homeroom_teacher') AND is_event_creator(event_id, auth.uid()));
```

### Storage RLS

Pentru ca CSE/profesor/diriginte să descarce fișierul submisiei din bucket-ul `event-files`, adaug politică pe `storage.objects` care verifică prin `form_submissions.event_id` că userul este creator. (Profesorul are deja acces prin politicile generice pe `event_files` — pentru `form_submissions` este bucket separat / același, verific la implementare.)

## Fișiere afectate

- **Edit** `src/pages/prof/ProfEventDetailPage.tsx` — etichete condiționate CSE, secțiune nouă "Formulare primite" cu query + mutații status
- **Migrație nouă** — extind enum status + RLS pentru `form_submissions` + storage policy

## Detalii de comportament

- Statusurile rămân vizibile și elevului (acesta vede deja statusul submisiei sale în `StudentEventDetailPage.tsx`)
- Modificarea statusului se loghează automat doar prin `updated_at` implicit; nu se cere audit suplimentar
- Lista submisiilor este sortată cronologic descendent (cele mai noi sus)
